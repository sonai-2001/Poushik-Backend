/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, genSalt } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiResponse } from '@common/types/api-response.type';
import { RefreshToken } from '@modules/refresh-token/schemas/refresh-token.schema';
import { RoleRepository } from '@modules/role/repositories/role.repository';
import { v4 as uuidv4 } from 'uuid';

import {
    ForgotPasswordDTO,
    ResetPasswordDTO,
    UserSignInDTO,
    RegisterStep1DTO,
    ParsedStep2PetOwnerDTO,
    Step2PetDoctorDTO,
    Step2SellerDTO,
} from '@modules/users/dto/user.dto';
import { UserRepository } from '@modules/users/repositories/user.repository';
import { Types } from 'mongoose';
import { RefreshJwtDto } from './dto/auth.dto';
import { RefreshTokenRepository } from '@modules/refresh-token/repository/refresh-token.repository';
import { JwtPayloadType } from '@common/types/jwt.type';
import { MailerService } from '@helpers/mailer.helper';
import { Messages } from '@common/constants/messages';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { UserDevice } from '@modules/user-devices/schemas/user-device.schema';
import { getClientIp } from 'request-ip';
import { lookup } from 'geoip-lite';
import { Request } from 'express';
import { UserDeviceRepository } from '@modules/user-devices/repository/user-device.repository';
import { WinstonLoggerService } from '@common/logger/winston.logger';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { RegistrationSessionRepository } from '@modules/registration-session/registration-session.repository';
import { PetOwnerRepository } from '@modules/pet-owner/pet.owner.repository';
import { PetDoctorRepository } from '@modules/pet-doctor/pet-doctor.repository';
import { PetSellerRepository } from '@modules/seller/seller.repository';

@Injectable()
export class AuthService {
    winston: WinstonLoggerService;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly roleRepository: RoleRepository,
        private readonly refreshTokenRepository: RefreshTokenRepository,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly mailerService: MailerService,
        private readonly userDeviceRepository: UserDeviceRepository,
        private readonly registrationRepo: RegistrationSessionRepository,
        private readonly petOwnerRepo: PetOwnerRepository,
        private readonly petDoctorRepo: PetDoctorRepository,
        private readonly petSellerRepo: PetSellerRepository,
    ) {
        this.winston = new WinstonLoggerService();
    }

    async generateRefreshToken(
        accessToken: string,
        user: string | Types.ObjectId,
    ): Promise<string> {
        const salt = await genSalt(10);

        const refreshToken = new RefreshToken();
        refreshToken.userId = user;
        refreshToken.hash = await hash(accessToken.split('.')[2] + salt, salt);
        await this.refreshTokenRepository.save(refreshToken);
        return salt;
    }

    async invalidAccessToken(user: Types.ObjectId): Promise<boolean> {
        const tokenDatas = await this.userDeviceRepository.getAllByField({
            user_id: user,
            expired: false,
            isDeleted: false,
        });

        tokenDatas.filter(async (tokenDoc) => {
            try {
                this.jwtService.verify(tokenDoc.accessToken, {
                    secret: this.configService.getOrThrow('JWT_SECRET'),
                });
            } catch (err) {
                await this.userDeviceRepository.updateById(
                    {
                        expired: true,
                    },
                    tokenDoc?._id,
                );
                // return false; // expired or tampered
            }
        });

        return true;
    }

    async refreshToken(body: RefreshJwtDto): Promise<ApiResponse> {
        const authToken = body.accessToken;

        const tokenData = await this.userDeviceRepository.getByField({
            accessToken: authToken,
            isLoggedOut: false,
            // "expired": true,
            isDeleted: false,
        });

        if (tokenData?._id) {
            const refreshTokenHash = await hash(
                body.accessToken.split('.')[2] + body.refreshToken,
                body.refreshToken,
            );

            const refreshTokenData = await this.refreshTokenRepository.getByField({
                hash: refreshTokenHash,
            });
            if (!refreshTokenData) throw new BadRequestException(Messages.INVALID_TOKEN_ERROR);

            const user = await this.userRepository.getByField({
                _id: new Types.ObjectId(refreshTokenData.userId),
                isDeleted: false,
                status: 'Active',
            });
            if (!user?._id) throw new BadRequestException(Messages.USER_MISSING_ERROR);

            const expiresDate = new Date(refreshTokenData.createdAt);
            expiresDate.setSeconds(
                expiresDate.getSeconds() +
                    this.configService.getOrThrow<number>('JWT_REFRESH_EXPIRES_IN'),
            );
            if (refreshTokenData.createdAt > expiresDate) {
                await this.refreshTokenRepository.delete(refreshTokenData._id);
                throw new UnauthorizedException(Messages.REFRESH_TOKEN_EXPIRED_ERROR);
            }

            const payload: JwtPayloadType = { id: refreshTokenData.userId.toString() };
            const token = this.jwtService.sign(payload);
            const salt = await genSalt(10);

            refreshTokenData.hash = await hash(token.split('.')[2] + salt, salt);

            if (refreshTokenData) {
                await this.refreshTokenRepository.save(refreshTokenData);
            }

            const existingDeviceData = await this.userDeviceRepository.getByField({
                accessToken: body.accessToken,
            });

            if (existingDeviceData?._id) {
                await this.userDeviceRepository.updateById(
                    {
                        accessToken: token,
                    },
                    existingDeviceData?._id,
                );
            }

            return {
                message: Messages.REFRESH_TOKEN_ISSUED_SUCCESS,
                data: { accessToken: token, refreshToken: salt },
            };
        } else {
            throw new UnauthorizedException('Token has been invalidated. Please log in again.');
        }
    }

    async startStep1(dto: RegisterStep1DTO, file?: Express.Multer.File) {
        const userRole = await this.roleRepository.getByField({
            role: dto.role,
            isDeleted: false,
        });
        if (!userRole?._id) throw new BadRequestException(Messages.ROLE_NOT_FOUND_ERROR);
        const existing = await this.registrationRepo.findByEmail(dto.email);
        if (existing)
            throw new BadRequestException('A registration session already exists with this email.');

        const hashedPassword = await hash(dto.password, 10);
        const regToken = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes TTL

        await this.registrationRepo.create({
            regToken,
            fullName: dto.fullName,
            email: dto.email,
            password: hashedPassword,
            role: dto.role,
            profileImage: file?.filename ?? null,
            expiresAt,
        });

        return {
            message: 'Step 1 completed. Proceed to next step.',
            regToken,
            nextStep: 'profile',
        };
    }
    async processStep2PetOwner(
        dto: ParsedStep2PetOwnerDTO,
        files: Express.Multer.File[] = [],
    ): Promise<{ message: string }> {
        const session = await this.registrationRepo.findByRegToken(dto.regToken);
        if (!session) {
            throw new BadRequestException('Invalid or expired registration token');
        }
        if (session.role != 'pet-owner') {
            throw new BadRequestException('Invalid role for this step');
        }
        if (session.step2Completed) {
            throw new BadRequestException('Step 2 already completed for this session.');
        }

        if (!Array.isArray(dto.pets) || dto.pets.length === 0) {
            throw new BadRequestException('At least one pet must be provided');
        }

        if (dto.pets.length !== files.length) {
            throw new BadRequestException('Mismatch between pets and uploaded images');
        }

        // Attach image filenames to pet objects
        const petsWithImages = dto.pets.map((pet, index) => ({
            ...pet,
            imageName: files[index]?.filename ?? null,
        }));

        // Update session with pet owner data
        await this.registrationRepo.updateByRegToken(dto.regToken, {
            petOwnerData: {
                phone: dto.phone,
                address: dto.address,
                pets: petsWithImages,
            },
            step2Completed: true,
            step: 'step2',
        });

        return {
            message:
                'Pet owner step 2 completed successfully. Proceed to final confirmation or login.',
        };
    }

    async processStep2PetDoctor(
        dto: Step2PetDoctorDTO,
        licenseFile?: Express.Multer.File,
        images: Express.Multer.File[] = [],
    ): Promise<{ message: string }> {
        const session = await this.registrationRepo.findByRegToken(dto.regToken);
        if (!session) throw new BadRequestException('Invalid or expired registration token');

        if (session.step2Completed)
            throw new BadRequestException('Step 2 already completed for this session.');
        if (session.role !== 'pet-doctor')
            throw new BadRequestException('You are not a pet doctor');

        if (!licenseFile) throw new BadRequestException('License document is required');

        const imageFilenames = images.map((img) => img.filename);

        await this.registrationRepo.updateByRegToken(dto.regToken, {
            petDoctorData: {
                phone: dto.phone,
                clinicName: dto.clinicName,
                clinicAddress: dto.clinicAddress,
                specialization: dto.specialization,
                licenseNumber: dto.licenseNumber,
                licenseDocument: licenseFile.filename,
                images: imageFilenames,
            },
            step2Completed: true,
            step: 'step2',
        });

        return { message: 'Pet doctor step 2 completed successfully.' };
    }

    async processStep2Seller(
        dto: Step2SellerDTO,
        licenseFile?: Express.Multer.File,
        images: Express.Multer.File[] = [],
    ): Promise<{ message: string }> {
        const session = await this.registrationRepo.findByRegToken(dto.regToken);
        if (!session) throw new BadRequestException('Invalid or expired registration token');

        if (session.step2Completed)
            throw new BadRequestException('Step 2 already completed for this session.');

        if (!licenseFile) throw new BadRequestException('License document is required');
        const imageFilenames = images.map((img) => img.filename);

        await this.registrationRepo.updateByRegToken(dto.regToken, {
            sellerData: {
                phone: dto.phone,
                storeName: dto.storeName,
                businessLicense: dto.businessLicense,
                licenseDocument: licenseFile.filename,
                images: imageFilenames,
            },
            step2Completed: true,
            step: 'step2',
        });

        return { message: 'Seller step 2 completed successfully.' };
    }

    async sendOtpToEmail(regToken: string) {
        const session = await this.registrationRepo.findByRegToken(regToken);
        if (!session) throw new BadRequestException('Invalid registration token');

        if (session.isEmailVerified) throw new BadRequestException('Email already verified');
        if (
            session.otpCode &&
            session.otpExpiresAt &&
            session.otpExpiresAt.getTime() > Date.now()
        ) {
            throw new BadRequestException(
                'An OTP has already been sent. Please wait until it expires.',
            );
        }
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 min

        await this.registrationRepo.updateByRegToken(regToken, {
            otpCode,
            otpExpiresAt,
        });

        await this.mailerService.sendMail(
            'no-reply@poshik.com',
            session.email,
            'Your POSHIK OTP Code',
            'otp-template', // ➜ views/email-templates/otp-template/html.ejs
            { name: session.fullName, otp: otpCode },
        );

        return { message: 'OTP sent to your email.' };
    }

    async verifyOtp(regToken: string, otp: string) {
        const session = await this.registrationRepo.findByRegToken(regToken);
        if (!session || !session.otpCode || !session.otpExpiresAt) {
            throw new BadRequestException('OTP not found. Please resend.');
        }

        if (session.otpExpiresAt.getTime() < Date.now()) {
            throw new BadRequestException('OTP expired. Please resend.');
        }

        if (session.otpCode !== otp) {
            throw new BadRequestException('Invalid OTP. Try again.');
        }

        if (session.isEmailVerified) {
            return { message: 'OTP already verified.' };
        }

        // ✅ Validate role
        if (!session.role) {
            throw new BadRequestException('User role missing in session.');
        }

        const roleId = await this.roleRepository.getIdByKey(session.role);

        // ✅ Step 1: Create User
        const createdUser = await this.userRepository.save({
            email: session.email,
            fullName: session.fullName,
            password: session.password, // Already hashed at registration step
            role: roleId,
            status: 'Active',
            isEmailVerified: true,
            profileImage: session.profileImage,
        });

        // ✅ Step 2: Create Role-Specific Profile
        switch (session.role) {
            case 'pet-owner':
                if (!session.petOwnerData) {
                    throw new BadRequestException('Missing pet owner details.');
                }
                console.log('Saving Pet Owner data...');

                await this.petOwnerRepo.save({
                    userId: createdUser._id,
                    ...session.petOwnerData,
                });
                break;

            case 'pet-doctor':
                if (!session.petDoctorData) {
                    throw new BadRequestException('Missing pet doctor details.');
                }
                await this.petDoctorRepo.save({
                    userId: createdUser._id,
                    ...session.petDoctorData,
                });
                break;

            case 'seller':
                if (!session.sellerData) {
                    throw new BadRequestException('Missing seller details.');
                }
                await this.petSellerRepo.save({
                    userId: createdUser._id,
                    ...session.sellerData,
                });
                break;

            default:
                throw new BadRequestException(`Invalid role: ${session.role}`);
        }

        // ✅ Step 3: Mark session complete
        await this.registrationRepo.updateByRegToken(regToken, {
            isEmailVerified: true,
            otpCode: null,
            otpExpiresAt: null,
            step2Completed: true,
        });

        return { message: 'OTP verified successfully. Account created!' };
    }

    async userSignup(body: RegisterStep1DTO, files: Express.Multer.File[]): Promise<ApiResponse> {
        const userRole = await this.roleRepository.getByField({
            role: body.role,
            isDeleted: false,
        });
        if (!userRole?._id) throw new BadRequestException(Messages.ROLE_NOT_FOUND_ERROR);

        const userExists = await this.userRepository.getByField({
            email: body.email,
            isDeleted: false,
        });
        if (userExists?._id) throw new BadRequestException(Messages.USER_EXIST_ERROR);

        if (files?.length) {
            for (const file of files) {
                body[file.fieldname] = file.filename;
            }
        }

        (body as Partial<UserDocument>).role = userRole._id;
        const saveUser = await this.userRepository.save(body);
        if (!saveUser?._id)
            throw new BadRequestException(
                saveUser instanceof Error ? saveUser?.message : Messages.SOMETHING_WENT_WRONG,
            );

        const userDetails = await this.userRepository.getUserDetails({
            _id: saveUser._id,
        });
        if (!userDetails) throw new BadRequestException(Messages.USER_MISSING_ERROR);

        const payload = { id: userDetails._id };
        const token = this.jwtService.sign(payload);
        const refreshToken = await this.generateRefreshToken(token, userDetails._id);

        return {
            message: Messages.USER_REGISTRATION_SUCCESS,
            data: {
                user: userDetails,
                accessToken: token,
                refreshToken: refreshToken,
            },
        };
    }

    async userLogin(body: UserSignInDTO, req: Request): Promise<ApiResponse> {
        const requestedRoute = req.originalUrl.split('/').pop();

        const checkIfExists = await this.userRepository.getByField({
            email: body.email,
            isDeleted: false,
        });

        if (!checkIfExists?._id) throw new BadRequestException(Messages.USER_MISSING_ERROR);

        if (!checkIfExists.validPassword(body.password)) {
            throw new BadRequestException(Messages.INVALID_CREDENTIALS_ERROR);
        }

        const userDetails = await this.userRepository.getUserDetails({
            _id: checkIfExists._id,
        });
        if (!userDetails) throw new BadRequestException(Messages.USER_MISSING_ERROR);

        if ((userDetails.role['role'] === 'admin') !== (requestedRoute === 'login-admin')) {
            throw new BadRequestException(Messages.INVALID_CREDENTIALS_ERROR);
        }

        if (userDetails.status === 'Inactive') {
            throw new BadRequestException(Messages.USER_INACTIVE_ERROR);
        }

        const payload = { id: checkIfExists._id };
        const token = this.jwtService.sign(payload);
        const refreshToken = await this.generateRefreshToken(token, checkIfExists._id);

        try {
            const ip = getClientIp(req);
            const geoIpInfo = ip ? lookup(ip) : null;
            if (ip) {
                const existingDeviceData = await this.userDeviceRepository.getByField({
                    accessToken: token,
                });
                const { ll, region, country, city, timezone } = geoIpInfo ?? {};
                const deviceInfo: Partial<UserDevice> = {
                    ip,
                    ip_lat: ll?.[0]?.toString() || '',
                    ip_long: ll?.[1]?.toString() || '',
                    last_active: Date.now(),
                    state: region || '',
                    country: country || '',
                    city: city || '',
                    timezone: timezone || '',
                    user_id: userDetails._id,
                    accessToken: token,
                    deviceToken: body.deviceToken ?? '',
                };
                await this.userDeviceRepository.saveOrUpdate(deviceInfo, existingDeviceData?._id);
            }
        } catch (err) {
            const stackTrace = (err as Error)?.stack
                ?.split('\n')
                ?.reverse()
                ?.slice(0, -2)
                ?.reverse()
                ?.join('\n');
            this.winston.error(stackTrace, 'userLoginService');
        }

        this.invalidAccessToken(userDetails._id);

        return {
            message: Messages.USER_LOGIN_SUCCESS,
            data: {
                user: userDetails,
                accessToken: token,
                refreshToken: refreshToken,
            },
        };
    }

    async forgotPassword(body: ForgotPasswordDTO): Promise<ApiResponse> {
        const checkIfExists = await this.userRepository.getByField({
            email: body.email,
            isDeleted: false,
        });
        if (!checkIfExists?._id) throw new BadRequestException(Messages.USER_MISSING_ERROR);

        const key = Buffer.from(this.configService.get<string>('CRYPTO_AES_KEY'), 'hex');
        const iv = Buffer.from(this.configService.get<string>('CRYPTO_AES_IV'), 'hex');

        const cipher = createCipheriv(this.configService.get('CRYPTO_ALGORITHM'), key, iv);
        const payload = JSON.stringify({
            id: checkIfExists._id,
            iat: Date.now() + 500 * 1000,
        });
        const token = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString(
            'hex',
        );

        const sender = `${this.configService.get<string>('PROJECT_NAME')} Admin<${this.configService.get<string>('SITE_EMAIL')}>`;
        const locals = {
            project_name: this.configService.get<string>('PROJECT_NAME'),
            resetLink: `${body.baseUrl}/reset-password/${token}`,
        };

        try {
            await this.mailerService.sendMail(
                sender,
                checkIfExists.email,
                'Password Reset Link',
                'forgot-password',
                locals,
            );
        } catch (error) {
            throw new BadRequestException(error);
        }

        await this.userRepository.saveOrUpdate(
            {
                resetPasswordToken: token,
            },
            checkIfExists._id,
        );

        return { message: Messages.FORGOT_PASSWORD_SUCCESS };
    }

    async resetPassword(body: ResetPasswordDTO): Promise<ApiResponse> {
        let decoded: { id: string; iat: number };

        try {
            const key = Buffer.from(this.configService.get<string>('CRYPTO_AES_KEY'), 'hex');
            const iv = Buffer.from(this.configService.get<string>('CRYPTO_AES_IV'), 'hex');

            const decipher = createDecipheriv(this.configService.get('CRYPTO_ALGORITHM'), key, iv);
            const decryptedData = Buffer.concat([
                decipher.update(Buffer.from(body.authToken, 'hex')),
                decipher.final(),
            ]);
            decoded = JSON.parse(decryptedData.toString('utf-8'));

            if (decoded.iat <= Date.now())
                throw new BadRequestException(Messages.INVALID_TOKEN_ERROR);
        } catch (error) {
            throw new BadRequestException(Messages.INVALID_TOKEN_ERROR);
        }

        const checkIfExists = await this.userRepository.getByField({
            _id: Types.ObjectId.createFromHexString(decoded.id),
            isDeleted: false,
        });
        if (!checkIfExists?._id) throw new BadRequestException(Messages.USER_MISSING_ERROR);

        if (checkIfExists.resetPasswordToken !== body.authToken) {
            throw new BadRequestException(Messages.INVALID_TOKEN_ERROR);
        }
        const updatePassword = await this.userRepository.updateById(
            { password: body.newPassword, resetPasswordToken: '' },
            checkIfExists._id,
        );
        if (!updatePassword) throw new BadRequestException(Messages.SOMETHING_WENT_WRONG);
        return { message: Messages.PASSWORD_UPDATE_SUCCESS };
    }

    async profileDetails(user: Partial<UserDocument>): Promise<ApiResponse> {
        const userDetails = await this.userRepository.getUserDetails({
            _id: new Types.ObjectId(user._id),
            isDeleted: false,
        });

        return { message: 'Profile details retrieved successfully.', data: userDetails };
    }

    async userLogout(req: Request): Promise<ApiResponse> {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Removes "Bearer "

            await this.userDeviceRepository.updateByField(
                {
                    isLoggedOut: true,
                },
                {
                    accessToken: token,
                },
            );

            return { message: Messages.USER_LOGOUT_SUCCESS };
        } catch (error) {
            throw new BadRequestException(Messages.SOMETHING_WENT_WRONG);
        }
    }
}
