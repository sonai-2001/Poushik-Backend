import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegistrationSession, RegistrationSessionSchema } from './registration-session.schema';
import { RegistrationSessionRepository } from './registration-session.repository';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: RegistrationSession.name, schema: RegistrationSessionSchema },
        ]),
    ],
    providers: [RegistrationSessionRepository],
    exports: [RegistrationSessionRepository], // so AuthService can use it
})
export class RegistrationSessionModule {}
