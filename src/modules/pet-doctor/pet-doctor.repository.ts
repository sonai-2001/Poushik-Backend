// src/modules/pet-doctor/pet-doctor.repository.ts

import { BaseRepository } from '@common/bases/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { PetDoctor, PetDoctorDocument } from './pet.doctor.schema';
import { PetOwnerDocument } from '@modules/pet-owner/pet-owner.schema';

@Injectable()
export class PetDoctorRepository extends BaseRepository<PetDoctorDocument> {
    private readonly petDoctorModel: Model<PetDoctorDocument>;
    constructor(@InjectModel(PetDoctor.name) petDoctorModel: Model<PetDoctorDocument>) {
        super(petDoctorModel);
        this.petDoctorModel = petDoctorModel;
    }

    // Custom method example
    async findByUserId(userId: string) {
        return this.petDoctorModel.findOne({ userId }, { _id: 0, userId: 0 });
    }
    async updateByUserId(
        userId: string,
        update: UpdateQuery<PetOwnerDocument>,
    ): Promise<PetOwnerDocument | null> {
        return this.petDoctorModel.findOneAndUpdate({ userId }, update, { new: true });
    }
}
