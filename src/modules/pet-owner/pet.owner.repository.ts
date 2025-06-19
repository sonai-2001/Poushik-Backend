// src/modules/pet-owner/pet-owner.repository.ts

import { BaseRepository } from '@common/bases/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PetOwner, PetOwnerDocument } from './pet-owner.schema';

@Injectable()
export class PetOwnerRepository extends BaseRepository<PetOwnerDocument> {
    private readonly petOwnerModel: Model<PetOwnerDocument>;
    constructor(@InjectModel(PetOwner.name) petOwnerModel: Model<PetOwnerDocument>) {
        super(petOwnerModel); // 💡 Passing the Mongoose model to base repository
        this.petOwnerModel = petOwnerModel;
    }

    // You can still add custom methods below if needed
    async findByPhone(phone: string) {
        return this.getByField({ phone });
    }
    async findByUserId(userId: string) {
        return this.petOwnerModel.findOne({ userId }, { _id: 0, userId: 0 });
    }
    async updateByUserId(
        userId: string,
        update: Partial<PetOwnerDocument>,
    ): Promise<PetOwnerDocument | null> {
        return this.petOwnerModel.findOneAndUpdate({ userId }, { $set: update }, { new: true });
    }

    // async updateByUserId(userId: string, updateData: UpdateQuery<PetDoctorDocument>) {
    //     return this.model.findOneAndUpdate({ userId }, updateData, { new: true });
    // }
}
