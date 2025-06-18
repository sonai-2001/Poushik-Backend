// src/modules/pet-owner/pet-owner.repository.ts

import { BaseRepository } from '@common/bases/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PetOwner, PetOwnerDocument } from './pet-owner.schema';

@Injectable()
export class PetOwnerRepository extends BaseRepository<PetOwnerDocument> {
    constructor(@InjectModel(PetOwner.name) petOwnerModel: Model<PetOwnerDocument>) {
        super(petOwnerModel); // 💡 Passing the Mongoose model to base repository
    }

    // You can still add custom methods below if needed
    async findByPhone(phone: string) {
        return this.getByField({ phone });
    }
}
