import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Req,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshJwtDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
    ForgotPasswordDTO,
    ResetPasswordDTO,
    UserSignInDTO,
    RegisterStep1DTO,
    Step2PetOwnerDTO,
    PetInfoDTO,
    ParsedStep2PetOwnerDTO,
    Step2PetDoctorDTO,
    Step2SellerDTO,
    SendOtpDTO,
    VerifyOtpDTO,
} from '@modules/users/dto/user.dto';
import {
    MultiFileInterceptor,
    SingleFileInterceptor,
} from '@common/interceptors/files.interceptor';
import { Request } from 'express';
import { LoginUser } from '@common/decorator/login-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login-admin')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    async loginAdmin(@Body() dto: UserSignInDTO, @Req() req: Request) {
        return this.authService.userLogin(dto, req);
    }

    @Post('login-user')
    @HttpCode(200)
    async loginUser(@Body() dto: UserSignInDTO, @Req() req: Request) {
        return this.authService.userLogin(dto, req);
    }

    @Post('register-step1')
    @UseGuards(ThrottlerGuard)
    @UseInterceptors(SingleFileInterceptor('users', 'profileImage'))
    @ApiConsumes('application/json', 'multipart/form-data')
    async signup(
        @Body() dto: RegisterStep1DTO,

        @UploadedFile() files: Express.Multer.File,
    ) {
        return this.authService.startStep1(dto, files);
    }

    @Post('register-step2/pet-owner')
    @UseGuards(ThrottlerGuard)
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(MultiFileInterceptor([{ name: 'petImages', directory: 'pets', maxCount: 10 }]))
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                regToken: { type: 'string' },
                phone: { type: 'string' },
                address: { type: 'string' },
                pets: {
                    type: 'string',
                    example: JSON.stringify([{ name: 'Buddy', type: 'Dog', breed: 'Beagle' }]),
                },
                petImages: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                },
            },
        },
    })
    async step2PetOwner(
        @Body() dto: Step2PetOwnerDTO,
        @UploadedFiles() files: { petImages?: Express.Multer.File[] },
    ) {
        let pets: PetInfoDTO[];

        try {
            pets = JSON.parse(dto.pets);
        } catch {
            throw new BadRequestException('Invalid pets JSON format');
        }

        if (!Array.isArray(pets) || pets.length === 0) {
            throw new BadRequestException('At least one pet must be provided');
        }

        // Attach image filenames
        pets.forEach((pet, index) => {
            pet.imageName = files.petImages?.[index]?.filename ?? null;
        });

        const parsedDto: ParsedStep2PetOwnerDTO = {
            ...dto,
            pets,
        };

        return this.authService.processStep2PetOwner(parsedDto, files.petImages ?? []);
    }

    @Post('register-step2/pet-doctor')
    @UseGuards(ThrottlerGuard)
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        MultiFileInterceptor([
            { name: 'licenseDocument', directory: 'licenses', maxCount: 1 },
            { name: 'images', directory: 'doctor-images', maxCount: 10 },
        ]),
    )
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                regToken: { type: 'string' },
                phone: { type: 'string' },
                clinicName: { type: 'string' },
                clinicAddress: { type: 'string' },
                specialization: { type: 'string' },
                licenseNumber: { type: 'string' },
                licenseDocument: {
                    type: 'string',
                    format: 'binary',
                },
                images: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        },
    })
    async step2PetDoctor(
        @Body() dto: Step2PetDoctorDTO,
        @UploadedFiles()
        files: {
            licenseDocument?: Express.Multer.File[];
            images?: Express.Multer.File[];
        },
    ) {
        const license = files.licenseDocument?.[0];
        const imageFiles = files.images ?? [];
        return this.authService.processStep2PetDoctor(dto, license, imageFiles);
    }

    @Post('register-step2/seller')
    @UseGuards(ThrottlerGuard)
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        MultiFileInterceptor([
            { name: 'licenseDocument', directory: 'licenses', maxCount: 1 },
            { name: 'images', directory: 'seller-images', maxCount: 10 },
        ]),
    )
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                regToken: { type: 'string' },
                phone: { type: 'string' },
                storeName: { type: 'string' },
                businessLicense: { type: 'string' },

                licenseDocument: {
                    type: 'string',
                    format: 'binary',
                },
                images: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        },
    })
    async step2Seller(
        @Body() dto: Step2SellerDTO,
        @UploadedFiles()
        files: { licenseDocument?: Express.Multer.File[]; images?: Express.Multer.File[] },
    ) {
        const licenseFile = files.licenseDocument?.[0];
        const imageFiles = files.images ?? [];
        return this.authService.processStep2Seller(dto, licenseFile, imageFiles);
    }

    @Post('send-otp')
    @ApiOperation({ summary: 'Send OTP to email after step 2' })
    async sendOtp(@Body() dto: SendOtpDTO) {
        return this.authService.sendOtpToEmail(dto.regToken);
    }

    @Post('verify-otp')
    @ApiOperation({ summary: 'Verify OTP sent to email' })
    async verifyOtp(@Body() dto: VerifyOtpDTO) {
        return this.authService.verifyOtp(dto.regToken, dto.otp);
    }

    @Post('forgot-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    async forgotPassword(@Body() dto: ForgotPasswordDTO) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    async resetPassword(@Body() dto: ResetPasswordDTO) {
        return this.authService.resetPassword(dto);
    }

    @Post('refresh-token')
    @HttpCode(200)
    // @UseGuards(AuthGuard('jwt'))
    @UseGuards(ThrottlerGuard)
    // @ApiBearerAuth()
    async refreshToken(@Body() dto: RefreshJwtDto) {
        return this.authService.refreshToken(dto);
    }

    @Get('profile-details')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @HttpCode(200)
    async profileDetails(@LoginUser() user: Partial<UserDocument>) {
        return this.authService.profileDetails(user);
    }

    @Get('logout-admin')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async logoutAdmin(@Req() req: Request) {
        return this.authService.userLogout(req);
    }

    @Get('logout-user')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async logoutUser(@Req() req: Request) {
        return this.authService.userLogout(req);
    }
}
