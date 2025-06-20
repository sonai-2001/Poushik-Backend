import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { RoleRepository } from '@modules/role/repositories/role.repository';
import {
    ChangeAdminProfilePasswordDto,
    ChangePasswordDto,
    ListingUserDto,
    SaveUserDTO,
    StatusUserDto,
    UpdateAdminProfileDto,
    UpdateFrontendUserDto,
    UpdatePetDoctorProfileDto,
    UpdatePetOwnerProfileDto,
    UpdatePetSellerProfileDto,
    UpdateUserDto,
} from './dto/user.dto';
import type { ApiResponse } from '@common/types/api-response.type';
import { UserRepository } from './repositories/user.repository';
import { UserDocument } from './schemas/user.schema';
import { Messages } from '@common/constants/messages';
import { UserDeviceRepository } from '@modules/user-devices/repository/user-device.repository';
import { PetOwnerRepository } from '@modules/pet-owner/pet.owner.repository';
import { PetDoctorRepository } from '@modules/pet-doctor/pet-doctor.repository';
import { sanitizeUpdatePayload } from '@helpers/sanitizer';
import { PetSellerRepository } from '@modules/seller/seller.repository';
// Somewhere near the service or top of the service file
type UpdatePetOwnerParsedDto = Omit<UpdatePetOwnerProfileDto, 'pets'> & {
    pets?: any[]; // or better: Array<{ name: string; type: string; breed: string; imageName?: string }>
};

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly userDeviceRepository: UserDeviceRepository,
        private readonly roleRepository: RoleRepository,
        private readonly PetOwnerRepository: PetOwnerRepository,
        private readonly PetDoctorRepository: PetDoctorRepository,
        private readonly PetSellerRepository: PetSellerRepository,
        // private readonly PetOwnerRepository: PetOwnerRepository,
    ) {}

    async updateAdminProfile(
        user: Partial<UserDocument>,
        body: UpdateAdminProfileDto,
        files: Express.Multer.File[],
    ): Promise<ApiResponse> {
        if (body.email) {
            const isEmailExists = await this.userRepository.getByField({
                email: body.email,
                isDeleted: false,
                _id: { $ne: user._id },
            });
            if (isEmailExists?._id)
                throw new BadRequestException('User with this email already exists!');
        }

        if (body.userName) {
            const isUserNameExists = await this.userRepository.getByField({
                userName: body.userName,
                isDeleted: false,
                _id: { $ne: user._id },
            });
            if (isUserNameExists?._id)
                throw new BadRequestException('User with this user name already exists!');
        }

        const updatedValue = {
            fullName: body.fullName ?? user.fullName,
            email: body.email ?? user.email,
            userName: body.userName ?? user.userName,
        };

        if (files?.length) {
            updatedValue['profileImage'] = files[0].filename;
        }

        // Save new User if the question doesn't exist
        const updateUser = await this.userRepository.updateById(updatedValue, user._id);
        if (!updateUser) {
            throw new BadRequestException(updateUser);
        }

        return { message: 'User updated successfully.', data: {} };
    }

    async changeAdminPassword(
        user: Partial<UserDocument>,
        body: ChangeAdminProfilePasswordDto,
    ): Promise<ApiResponse> {
        const userData = await this.userRepository.getById(user._id);

        const oldPasswordMatch = userData.validPassword(body.currentPassword);
        if (!oldPasswordMatch) throw new BadRequestException('Old credential mis-matched!');

        const newPassVsOldPass = userData.validPassword(body.password);
        if (newPassVsOldPass)
            throw new BadRequestException('New password cannot be same as your old password!');

        const userUpdate = await this.userRepository.updateById(
            { password: body.password },
            userData._id,
        );
        if (!userUpdate) {
            throw new BadRequestException(userUpdate);
        }

        return { message: 'User password updated successfully.', data: userUpdate };
    }

    async getAllUsers(body: ListingUserDto): Promise<ApiResponse> {
        // const superAdminDetails = await this.roleRepository.getByField({ 'role': 'admin', isDeleted: false });
        // body['role'] = superAdminDetails._id;

        const getAllUsers = await this.userRepository.getAllPaginateAdmin(body);
        return { message: 'User data fetched successfully.', data: getAllUsers };
    }

    async profileDetails(user: Partial<UserDocument>): Promise<ApiResponse> {
        const userDetails = await this.userRepository.getUserDetails({
            _id: new Types.ObjectId(user._id),
            isDeleted: false,
        });

        return { message: 'Profile details retrieved successfully.', data: userDetails };
    }

    async saveUser(body: SaveUserDTO, files: Express.Multer.File[]): Promise<ApiResponse> {
        const userRole = await this.roleRepository.getByField({
            _id: new Types.ObjectId(body.role),
            isDeleted: false,
        });
        if (!userRole?._id) throw new BadRequestException('User role not found!');

        if (userRole.role === 'admin')
            throw new BadRequestException('Assigning an admin role is not allowed!');

        const isEmailExists = await this.userRepository.getByField({
            email: { $regex: '^' + body.email + '$', $options: 'i' },
            isDeleted: false,
        });
        if (isEmailExists?._id) throw new ConflictException('User with this email already exists!');

        const isUserNameExists = await this.userRepository.getByField({
            userName: body.userName,
            isDeleted: false,
        });
        if (isUserNameExists?._id)
            throw new ConflictException('User with this user name already exists!');

        if (files?.length) {
            body.profileImage = files[0].filename;
        }

        // Save new User if the question doesn't exist
        const saveUser = await this.userRepository.save(body);
        if (!saveUser) {
            throw new BadRequestException(saveUser);
        }

        return { message: 'User added successfully.' };
    }

    async getUser(id: string): Promise<ApiResponse> {
        const user = await this.userRepository.getByFieldWithProjection(
            { _id: new Types.ObjectId(id), isDeleted: false },
            {
                userName: 1,
                fullName: 1,
                email: 1,
                profileImage: 1,
                role: 1,
            },
        );

        if (!user) throw new NotFoundException('User not found!');
        return { message: 'User retrieved successfully.', data: user };
    }

    async updateUser(
        id: string,
        body: UpdateUserDto,
        files: Express.Multer.File[],
    ): Promise<ApiResponse> {
        const isUserExists = await this.userRepository.getByField({
            isDeleted: false,
            _id: new Types.ObjectId(id),
        });
        if (!isUserExists) throw new NotFoundException('User not found!');

        const checkUserRole = await this.roleRepository.getByField({
            _id: isUserExists.role,
            isDeleted: false,
        });

        if (checkUserRole?._id && checkUserRole.role == 'admin')
            throw new BadRequestException('Modifying a user with an admin role is restricted!');

        if (body.email) {
            const isEmailExists = await this.userRepository.getByField({
                email: body.email,
                isDeleted: false,
                _id: { $ne: isUserExists._id },
            });
            if (isEmailExists?._id)
                throw new ConflictException('User with this email already exists!');
        }

        if (body.userName) {
            const isUserNameExists = await this.userRepository.getByField({
                userName: body.userName,
                isDeleted: false,
                _id: { $ne: isUserExists._id },
            });
            if (isUserNameExists?._id)
                throw new ConflictException('User with this user name already exists!');
        }

        if (body.role) {
            const userRole = await this.roleRepository.getByField({
                _id: new Types.ObjectId(body.role),
                isDeleted: false,
            });
            if (!userRole?._id) throw new BadRequestException('User role not found!');

            if (userRole.role === 'admin')
                throw new BadRequestException('Assigning an admin role is not allowed!');
        }

        const updatedValue = {
            fullName: body.fullName ?? isUserExists.fullName,
            email: body.email ?? isUserExists.email,
            role: body.role ?? isUserExists.role,
            userName: body.userName ?? isUserExists.userName,
        };

        if (files?.length) {
            updatedValue['profileImage'] = files[0].filename;
        }

        // Save new User if the question doesn't exist
        const updateUser = await this.userRepository.updateById(updatedValue, isUserExists._id);
        if (!updateUser) {
            throw new BadRequestException(updateUser);
        }

        return { message: 'User updated successfully.', data: updateUser };
    }

    async changePassword(id: string, body: ChangePasswordDto): Promise<ApiResponse> {
        const isUserExists = await this.userRepository.getByFieldWithProjection(
            { isDeleted: false, _id: new Types.ObjectId(id) },
            { password: 1 },
        );
        if (!isUserExists) throw new NotFoundException('User not found!');

        const checkUserRole = await this.roleRepository.getByField({
            _id: isUserExists.role,
            isDeleted: false,
        });

        if (checkUserRole?._id && checkUserRole.role == 'admin')
            throw new BadRequestException('Modifying a user with an admin role is restricted!');

        if (body.password !== body.confirmPassword) {
            throw new BadRequestException('Passwords do not match!');
        }

        // const oldPasswordMatch = isUserExists.validPassword(body.currentPassword);
        // if (!oldPasswordMatch) throw new BadRequestException('Old credential mis-matched!');

        // const newPassVsOldPass = isUserExists.validPassword(body.password);
        // if (newPassVsOldPass) throw new BadRequestException('New password cannot be same as your old password!');

        const userUpdate = await this.userRepository.updateById(
            { password: body.password },
            new Types.ObjectId(id),
        );
        if (!userUpdate) {
            throw new BadRequestException(userUpdate);
        }

        return { message: 'User password updated successfully.', data: userUpdate };
    }

    async deleteUser(id: string): Promise<ApiResponse> {
        const isUserExists = await this.userRepository.getByField({
            isDeleted: false,
            _id: new Types.ObjectId(id),
        });
        if (!isUserExists) throw new NotFoundException('User not found!');

        const checkUserRole = await this.roleRepository.getByField({
            _id: isUserExists.role,
            isDeleted: false,
        });

        if (checkUserRole?._id && checkUserRole.role == 'admin')
            throw new BadRequestException('Modifying a user with an admin role is restricted!');

        const deleteData = await this.userRepository.updateById({ isDeleted: true }, id);
        if (!deleteData) {
            throw new BadRequestException(deleteData);
        }

        return { message: 'User deleted successfully.' };
    }

    async updateUserStatus(id: string, body: StatusUserDto): Promise<ApiResponse> {
        const isUserExists = await this.userRepository.getByField({
            isDeleted: false,
            _id: new Types.ObjectId(id),
        });
        if (!isUserExists) throw new NotFoundException('User not found!');

        const checkUserRole = await this.roleRepository.getByField({
            _id: isUserExists.role,
            isDeleted: false,
        });

        if (checkUserRole?._id && checkUserRole.role == 'admin')
            throw new BadRequestException('Modifying a user with an admin role is restricted!');

        const updateStatus = await this.userRepository.updateById(
            { status: body.status },
            new Types.ObjectId(id),
        );
        if (!updateStatus) {
            throw new BadRequestException(updateStatus);
        }

        if (updateStatus.status !== 'Active') {
            await this.userDeviceRepository.updateAllByParams(
                { isLoggedOut: true },
                { user_id: updateStatus._id },
            );
        }

        return { message: 'Status updated successfully.', data: updateStatus };
    }

    async updateFrontendUser(
        user: Partial<UserDocument>,
        body: UpdateFrontendUserDto,
        files: Express.Multer.File[],
    ): Promise<ApiResponse> {
        const isEmailExists = await this.userRepository.getByField({
            email: { $regex: '^' + body.email + '$', $options: 'i' },
            isDeleted: false,
            _id: { $ne: user._id },
        });
        if (isEmailExists?._id) throw new ConflictException(Messages.USER_EXIST_ERROR);

        const isUserNameExists = await this.userRepository.getByField({
            userName: body.userName,
            isDeleted: false,
            _id: { $ne: user._id },
        });
        if (isUserNameExists?._id) throw new ConflictException(Messages.USERNAME_EXIST_ERROR);

        if (files?.length) {
            for (const file of files) {
                body[file.fieldname] = file.filename;
            }
        }

        const updateUser = await this.userRepository.updateById(body, user._id);
        if (!updateUser)
            throw new BadRequestException(
                updateUser instanceof Error ? updateUser.message : Messages.SOMETHING_WENT_WRONG,
            );
        return { message: Messages.PROFILE_UPDATE_SUCCESS, data: updateUser };
    }

    async updatePetOwnerProfile(
        userId: string,
        dto: UpdatePetOwnerParsedDto,
        fileData: {
            profileImage?: string;
            petImages?: string[];
        },
    ): Promise<{ message: string }> {
        const { firstName, lastName, phone, address, pets } = dto;

        // 1️⃣ Update shared User info
        const userUpdatePayload: any = {};

        if (firstName !== undefined) userUpdatePayload.firstName = firstName;
        if (lastName !== undefined) userUpdatePayload.lastName = lastName;
        if (fileData.profileImage) userUpdatePayload.profileImage = fileData.profileImage;
        const sanitizedUserUpdate = sanitizeUpdatePayload(userUpdatePayload);

        if (Object.keys(sanitizedUserUpdate).length > 0) {
            await this.userRepository.updateById(sanitizedUserUpdate, userId);
        }

        // 2️⃣ Update Pet Owner specific data
        const petOwnerUpdatePayload: any = {};

        if (phone !== undefined) petOwnerUpdatePayload.phone = phone;
        if (address !== undefined) petOwnerUpdatePayload.address = address;
        if (pets !== undefined) petOwnerUpdatePayload.pets = pets;
        const sanitizedPetOwnerUpdate = sanitizeUpdatePayload(petOwnerUpdatePayload);

        if (Object.keys(sanitizedPetOwnerUpdate).length > 0) {
            await this.PetOwnerRepository.updateByUserId(userId, sanitizedPetOwnerUpdate);
        }

        return { message: 'Pet owner profile updated successfully.' };
    }
    async updatePetDoctorProfile(
        userId: string,
        dto: UpdatePetDoctorProfileDto,
        fileData: {
            profileImage?: string;
            images?: string[];
        },
    ): Promise<{ message: string }> {
        const { firstName, lastName, phone, clinicName, clinicAddress, specialization } = dto;

        // 1️⃣ Update shared User info
        const userUpdatePayload: any = {};

        if (firstName !== undefined) userUpdatePayload.firstName = firstName;
        if (lastName !== undefined) userUpdatePayload.lastName = lastName;
        if (fileData.profileImage) userUpdatePayload.profileImage = fileData.profileImage;
        const sanitizedUserUpdate = sanitizeUpdatePayload(userUpdatePayload);
        if (Object.keys(sanitizedUserUpdate).length > 0) {
            await this.userRepository.updateById({ $set: sanitizedUserUpdate }, userId);
        }

        // 2️⃣ Update Pet Doctor specific info
        const petDoctorUpdatePayload: any = {};

        if (phone !== undefined) petDoctorUpdatePayload.phone = phone;
        if (clinicName !== undefined) petDoctorUpdatePayload.clinicName = clinicName;
        if (clinicAddress !== undefined) petDoctorUpdatePayload.clinicAddress = clinicAddress;
        if (specialization !== undefined) petDoctorUpdatePayload.specialization = specialization;
        if (fileData.images?.length) petDoctorUpdatePayload.images = fileData.images;

        const sanitizedDoctorUpdate = sanitizeUpdatePayload(petDoctorUpdatePayload);

        if (Object.keys(sanitizedDoctorUpdate).length > 0) {
            await this.PetDoctorRepository.updateByUserId(userId, { $set: sanitizedDoctorUpdate });
        }

        return { message: 'Pet doctor profile updated successfully.' };
    }
    async updatePetSellerProfile(
        userId: string,
        dto: UpdatePetSellerProfileDto,
        fileData: {
            profileImage?: string;
            images?: string[];
        },
    ): Promise<{ message: string }> {
        const { firstName, lastName, phone, storeName, storeAddress } = dto;

        // 1️⃣ Update shared User info
        const userUpdatePayload: any = {};

        if (firstName !== undefined) userUpdatePayload.firstName = firstName;
        if (lastName !== undefined) userUpdatePayload.lastName = lastName;
        if (fileData.profileImage) userUpdatePayload.profileImage = fileData.profileImage;
        const sanitizedUserUpdate = sanitizeUpdatePayload(userUpdatePayload);
        if (Object.keys(sanitizedUserUpdate).length > 0) {
            await this.userRepository.updateById({ $set: sanitizedUserUpdate }, userId);
        }

        // 2️⃣ Update Pet Doctor specific info
        const petSellerUpdatePayload: any = {};

        if (phone !== undefined) petSellerUpdatePayload.phone = phone;
        if (storeName !== undefined) petSellerUpdatePayload.clinicName = storeName;
        if (storeAddress !== undefined) petSellerUpdatePayload.clinicAddress = storeAddress;
        if (fileData.images?.length) petSellerUpdatePayload.images = fileData.images;

        const sanitizedSellerUpdate = sanitizeUpdatePayload(petSellerUpdatePayload);

        if (Object.keys(sanitizedSellerUpdate).length > 0) {
            await this.PetSellerRepository.updateByUserId(userId, { $set: sanitizedSellerUpdate });
        }

        return { message: 'Pet doctor profile updated successfully.' };
    }
}
