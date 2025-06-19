import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from '@common/bases/base.repository';
import { User, UserDocument } from '../schemas/user.schema';
import { ListingUserDto } from '../dto/user.dto';
import { PaginationResponse } from '@common/types/api-response.type';
import { PetOwnerRepository } from '@modules/pet-owner/pet.owner.repository';
import { PetSellerRepository } from '@modules/seller/seller.repository';
import { PetDoctorRepository } from '@modules/pet-doctor/pet-doctor.repository';

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
    constructor(
        @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
        private readonly petOwnerRepo: PetOwnerRepository,
        private readonly petSellerRepo: PetSellerRepository,
        private readonly petDoctorRepo: PetDoctorRepository,
    ) {
        super(UserModel);
    }

    async getUserDetailsJwtAuth(id: Types.ObjectId | string): Promise<UserDocument> {
        const user = await this.UserModel.aggregate([
            { $match: { _id: new Types.ObjectId(id), isDeleted: false, status: 'Active' } },
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role',
                    foreignField: '_id',
                    as: 'role',
                    pipeline: [
                        { $match: { isDeleted: false } },
                        {
                            $project: {
                                _id: 0,
                                role: '$role',
                                roleDisplayName: '$roleDisplayName',
                            },
                        },
                    ],
                },
            },
            { $unwind: '$role' },
            {
                $project: {
                    _id: '$_id',
                    role: '$role',
                    firstName: '$firstName',
                    lastName: '$lastName',
                    fullName: '$fullName',
                    email: '$email',
                    userName: '$userName',
                    password: '$password',
                    profileImage: '$profileImage',
                    status: '$status',
                    isDeleted: '$isDeleted',
                },
            },
        ]);

        if (!user?.length) return null;
        return user[0];
    }

    async fineOneWithRole(params: FilterQuery<UserDocument>): Promise<UserDocument> {
        return await this.UserModel.findOne(params).populate('role').exec();
    }

    async getUserDetails(params: FilterQuery<UserDocument>): Promise<any> {
        const aggregate = await this.UserModel.aggregate([
            { $match: params },
            {
                $lookup: {
                    from: 'roles',
                    let: { roleId: '$role' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$roleId'] },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                role: 1,
                                roleDisplayName: 1,
                                roleGroup: 1,
                                status: 1,
                            },
                        },
                    ],
                    as: 'role',
                },
            },
            { $unwind: '$role' },
            {
                $project: {
                    password: 0,
                    isDeleted: 0,
                    updatedAt: 0,
                    otpCode: 0,
                    otpExpiresAt: 0,
                    regToken: 0,
                    resetPasswordToken: 0,
                },
            },
        ]);

        const user = aggregate?.[0];
        if (!user) return null;

        const roleKey = user.role?.role;
        const userId = user._id;
        // console.log(roleKey);
        console.log('user id is', userId);
        let moreprofileDetails = null;
        switch (roleKey) {
            case 'pet-owner':
                moreprofileDetails = await this.petOwnerRepo.findByUserId(userId);
                break;
            case 'seller':
                moreprofileDetails = await this.petSellerRepo.findByUserId(userId);
                break;
            case 'pet-doctor':
                moreprofileDetails = await this.petDoctorRepo.findByUserId(userId);
                break;
            default:
                break;
        }

        return {
            ...user,
            moreprofileDetails,
        };
    }

    async getAllPaginateAdmin(
        paginatedDto: ListingUserDto,
    ): Promise<PaginationResponse<UserDocument>> {
        const conditions = {};
        const and_clauses = [];
        const page = paginatedDto.page || 1;
        const limit = paginatedDto.limit || 10;
        const skip = (page - 1) * limit;
        and_clauses.push({ isDeleted: false });
        if (paginatedDto.search) {
            const searchRegex = new RegExp(paginatedDto.search, 'i');
            and_clauses.push({
                $or: [{ fullName: searchRegex }, { email: searchRegex }, { userName: searchRegex }],
            });
        }

        // Optional status filter
        if (paginatedDto.role) {
            and_clauses.push({ role: paginatedDto.role });
        }

        if (paginatedDto.status) {
            and_clauses.push({ status: paginatedDto.status });
        }

        // Optional sorting
        const sortField = paginatedDto.sortField || '_id';
        const sortOrder = paginatedDto.sortOrder === 'asc' ? 1 : -1;

        conditions['$and'] = and_clauses;

        const filterPipeline: PipelineStage[] = [
            { $match: conditions },
            { $skip: skip },
            { $limit: +limit },
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role',
                    foreignField: '_id',
                    as: 'role',
                    pipeline: [{ $match: { isDeleted: false, role: { $ne: 'admin' } } }],
                },
            },
            {
                $unwind: {
                    // preserveNullAndEmptyArrays: true,
                    path: '$role',
                },
            },
            {
                $project: {
                    fullName: 1,
                    email: 1,
                    userName: 1,
                    profileImage: 1,
                    createdAt: 1,
                    status: 1,
                },
            },
            { $sort: { [sortField]: sortOrder } }, // Dynamic sorting
        ];

        const countPipeline: PipelineStage[] = [{ $match: conditions }, { $count: 'total' }];

        // Perform the aggregation
        const [countResult, aggregate] = await Promise.all([
            this.UserModel.aggregate(countPipeline, { allowDiskUse: true })
                .exec()
                .catch((error) => {
                    throw new InternalServerErrorException(
                        `Error during count aggregation: ${error.message}`,
                    );
                }),
            this.UserModel.aggregate(filterPipeline, { allowDiskUse: true })
                .exec()
                .catch((error) => {
                    throw new InternalServerErrorException(
                        `Error during data aggregation: ${error.message}`,
                    );
                }),
        ]);

        console.log({ aggregate });

        const totalDocs = countResult.length ? countResult[0].total : 0;
        const hasMoreDocs = totalDocs > 0;
        const remainingDocs = totalDocs - (skip + aggregate.length) > 0;
        const hasNextPage = hasMoreDocs && remainingDocs;
        const hasPrevPage = page != 1;
        const totalPages = Math.ceil(totalDocs / limit);

        return {
            meta: {
                totalDocs: countResult.length ? countResult[0].total : 0,
                skip: skip,
                page: page,
                totalPages: totalPages,
                limit: limit,
                hasPrevPage,
                hasNextPage,
                prevPage: hasPrevPage ? page - 1 : null,
                nextPage: hasNextPage ? page + 1 : null,
            },
            docs: aggregate,
        };
    }

    async getAllPaginateFrontend(
        paginatedDto: ListingUserDto,
    ): Promise<PaginationResponse<UserDocument>> {
        const conditions = {};
        const and_clauses = [];
        const page = paginatedDto.page || 1;
        const limit = paginatedDto.limit || 10;
        const skip = (page - 1) * limit;
        and_clauses.push({ isDeleted: false, role: { $eq: paginatedDto.role } });
        // Optional search condition
        if (paginatedDto.search) {
            const searchRegex = new RegExp(paginatedDto.search, 'i'); // Case-insensitive search
            and_clauses.push({
                $or: [{ fullName: searchRegex }, { email: searchRegex }, { userName: searchRegex }],
            });
        }

        // Optional status filter
        if (paginatedDto.status) {
            and_clauses.push({ status: paginatedDto.status });
        }

        // Optional sorting
        const sortField = paginatedDto.sortField || '_id'; // Default to sorting by _id if no field is provided
        const sortOrder = paginatedDto.sortOrder === 'asc' ? 1 : -1; // Default to descending order if not provided

        conditions['$and'] = and_clauses;

        const filterPipeline: PipelineStage[] = [
            { $match: conditions },
            { $skip: skip },
            { $limit: +limit },
            {
                $project: {
                    fullName: 1,
                    email: 1,
                    userName: 1,
                    profileImage: 1,
                    createdAt: 1,
                    status: 1,
                },
            },
            { $sort: { [sortField]: sortOrder } }, // Dynamic sorting
        ];

        const countPipeline: PipelineStage[] = [{ $match: conditions }, { $count: 'total' }];

        // Perform the aggregation
        const [countResult, aggregate] = await Promise.all([
            this.UserModel.aggregate(countPipeline, { allowDiskUse: true })
                .exec()
                .catch((error) => {
                    throw new InternalServerErrorException(
                        `Error during count aggregation: ${error.message}`,
                    );
                }),
            this.UserModel.aggregate(filterPipeline, { allowDiskUse: true })
                .exec()
                .catch((error) => {
                    throw new InternalServerErrorException(
                        `Error during data aggregation: ${error.message}`,
                    );
                }),
        ]);

        const totalDocs = countResult.length ? countResult[0].total : 0;
        const hasMoreDocs = totalDocs > 0;
        const remainingDocs = totalDocs - (skip + aggregate.length) > 0;
        const hasNextPage = hasMoreDocs && remainingDocs;
        const hasPrevPage = page != 1;
        const totalPages = Math.ceil(totalDocs / limit);

        return {
            meta: {
                totalDocs: countResult.length ? countResult[0].total : 0,
                skip: skip,
                page: page,
                totalPages: totalPages,
                limit: limit,
                hasPrevPage,
                hasNextPage,
                prevPage: hasPrevPage ? page - 1 : null,
                nextPage: hasNextPage ? page + 1 : null,
            },
            docs: aggregate,
        };
    }
    async findByEmail(email: string) {
        return this.UserModel.findOne({ email, isDeleted: false });
    }

    async createUser(data: Partial<User>) {
        return this.UserModel.create(data);
    }

    async updateByRegToken(token: string, update: Partial<User>) {
        return this.UserModel.findOneAndUpdate({ regToken: token }, update, { new: true });
    }
}
