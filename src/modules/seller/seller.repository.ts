// src/modules/pet-seller/pet-seller.repository.ts

import { BaseRepository } from '@common/bases/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PetSeller, PetSellerDocument } from './seller.schema';

@Injectable()
export class PetSellerRepository extends BaseRepository<PetSellerDocument> {
    private readonly sellerModel: Model<PetSellerDocument>;
    constructor(@InjectModel(PetSeller.name) sellerModel: Model<PetSellerDocument>) {
        super(sellerModel);
        this.sellerModel = sellerModel;
    }

    async findByUserId(userId: string) {
        return this.sellerModel.findOne({ userId }, { _id: 0, userId: 0 });
    }
}
