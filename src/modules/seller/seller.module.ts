// src/modules/pet-seller/pet-seller.module.ts

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetSeller, PetSellerSchema } from './seller.schema';
import { PetSellerRepository } from './seller.repository';
@Global()
@Module({
    imports: [MongooseModule.forFeature([{ name: PetSeller.name, schema: PetSellerSchema }])],
    providers: [PetSellerRepository],
    exports: [PetSellerRepository],
})
export class PetSellerModule {}
