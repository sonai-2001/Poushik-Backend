import {
    Controller,
    UseGuards,
    HttpCode,
    Body,
    UploadedFiles,
    UseInterceptors,
    Patch,
    ValidationPipe,
    BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { LoginUser } from '@common/decorator/login-user.decorator';
import { MultiFileInterceptor } from '@common/interceptors/files.interceptor';
import {
    UpdatePetDoctorProfileDto,
    UpdatePetOwnerProfileDto,
    UpdatePetSellerProfileDto,
} from './dto/user.dto';
import { Roles } from '@common/decorator/role.decorator';
import { RBAcGuard } from '@common/guards/rbac.guard';
import { UserRole } from '@common/enum/user-role.enum';

@ApiTags('Frontend User')
@Controller('user')
export class UserApiController {
    constructor(private readonly userService: UserService) {}

    @Patch('pet-owner/update-profile')
    @UseGuards(AuthGuard('jwt'), RBAcGuard)
    @Roles(UserRole.PET_OWNER)
    @ApiConsumes('multipart/form-data')
    @HttpCode(200)
    @ApiBearerAuth()
    @UseInterceptors(
        MultiFileInterceptor([
            { name: 'profileImage', directory: 'profile', maxCount: 1 },
            { name: 'petImages', directory: 'pets', maxCount: 10 },
        ]),
    )
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                phone: { type: 'string' },
                address: { type: 'string' },
                pets: {
                    type: 'string',
                    example: JSON.stringify([{ name: 'Rocky', type: 'Dog', breed: 'Labrador' }]),
                },
                profileImage: { type: 'string', format: 'binary' },
                petImages: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                },
            },
        },
    })
    async updatePetOwnerProfile(
        @LoginUser() user: any,
        @Body(new ValidationPipe({ transform: true }))
        dto: Omit<UpdatePetOwnerProfileDto, 'pets'> & { pets?: string },

        @UploadedFiles()
        files: {
            profileImage?: Express.Multer.File[];
            petImages?: Express.Multer.File[];
        },
    ) {
        // 🧠 Parse pet JSON
        let petsParsed: any[] = [];

        if (dto.pets) {
            try {
                petsParsed = JSON.parse(dto.pets);
            } catch {
                throw new BadRequestException('Invalid JSON in pets field');
            }

            petsParsed = petsParsed.map((pet, index) => ({
                ...pet,
                imageName: files?.petImages?.[index]?.filename ?? null,
            }));
        }
        type UpdatePetOwnerPayload = Omit<UpdatePetOwnerProfileDto, 'pets'> & { pets?: any[] };
        const updatePayload: UpdatePetOwnerPayload = {
            ...dto,
            pets: petsParsed,
        };

        return this.userService.updatePetOwnerProfile(user._id, updatePayload, {
            profileImage: files?.profileImage?.[0]?.filename,
            petImages: files?.petImages?.map((file) => file.filename) ?? [],
        });
    }

    @Patch('pet-doctor/update-profile')
    @UseGuards(AuthGuard('jwt'), RBAcGuard)
    @Roles(UserRole.PET_DOCTOR)
    @ApiConsumes('multipart/form-data')
    @HttpCode(200)
    @ApiBearerAuth()
    @UseInterceptors(
        MultiFileInterceptor([
            { name: 'images', directory: 'doctor-images', maxCount: 5 },
            { name: 'profileImage', directory: 'profile', maxCount: 1 },
        ]),
    )
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                firstName: { type: 'string', example: 'Dr. John' },
                lastName: { type: 'string', example: 'Doe' },
                phone: { type: 'string', example: '+1-202-555-0198' },
                clinicName: { type: 'string', example: 'Healthy Paws Clinic' },
                clinicAddress: { type: 'string', example: '456 Vet Lane, Petville' },
                specialization: { type: 'string', example: 'Small Animal Surgery' },
                profileImage: { type: 'string', format: 'binary' },
                images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                },
            },
        },
    })
    async updatePetDoctorProfile(
        @LoginUser() user: any,
        @Body(new ValidationPipe({ transform: true })) dto: UpdatePetDoctorProfileDto,
        @UploadedFiles()
        files: {
            profileImage?: Express.Multer.File[];
            images?: Express.Multer.File[];
        },
    ) {
        return this.userService.updatePetDoctorProfile(user._id, dto, {
            profileImage: files?.profileImage?.[0]?.filename,
            images: files?.images?.map((file) => file.filename) ?? [],
        });
    }

    @Patch('pet-seller/update-profile')
    @UseGuards(AuthGuard('jwt'), RBAcGuard)
    @Roles(UserRole.SELLER)
    @ApiConsumes('multipart/form-data')
    @HttpCode(200)
    @ApiBearerAuth()
    @UseInterceptors(
        MultiFileInterceptor([
            { name: 'images', directory: 'seller-images', maxCount: 5 },
            { name: 'profileImage', directory: 'profile', maxCount: 1 },
        ]),
    )
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                firstName: { type: 'string', example: 'Dr. John' },
                lastName: { type: 'string', example: 'Doe' },
                phone: { type: 'string', example: '+1-202-555-0198' },
                storeName: { type: 'string', example: 'Healthy Paws Clinic' },
                storeAddress: { type: 'string', example: '456 Vet Lane, Petville' },
                profileImage: { type: 'string', format: 'binary' },
                images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                },
            },
        },
    })
    async updatePetSellerProfile(
        @LoginUser() user: any,
        @Body(new ValidationPipe({ transform: true })) dto: UpdatePetSellerProfileDto,
        @UploadedFiles()
        files: {
            profileImage?: Express.Multer.File[];
            images?: Express.Multer.File[];
        },
    ) {
        return this.userService.updatePetSellerProfile(user._id, dto, {
            profileImage: files?.profileImage?.[0]?.filename,
            images: files?.images?.map((file) => file.filename) ?? [],
        });
    }
}
