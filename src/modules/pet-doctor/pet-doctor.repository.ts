// src/modules/pet-doctor/pet-doctor.repository.ts

import { BaseRepository } from '@common/bases/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PetDoctor, PetDoctorDocument } from './pet.doctor.schema';

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
}
