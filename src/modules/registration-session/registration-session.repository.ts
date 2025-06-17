import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegistrationSession } from './registration-session.schema';

@Injectable()
export class RegistrationSessionRepository {
    constructor(
    @InjectModel(RegistrationSession.name)
    private readonly model: Model<RegistrationSession>,
    ) {}

    async findByEmail(email: string) {
        return this.model.findOne({ email });
    }

    async findByRegToken(token: string) {
        return this.model.findOne({ regToken: token });
    }

    async create(data: Partial<RegistrationSession>) {
        return this.model.create(data);
    }

    async updateByRegToken(token: string, update: Partial<RegistrationSession>) {
        return this.model.findOneAndUpdate({ regToken: token }, update, {
            new: true,
        });
    }
}
