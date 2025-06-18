// src/modules/pet-owner/pet-owner.module.ts

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetOwner, PetOwnerSchema } from './pet-owner.schema';
import { PetOwnerRepository } from './pet.owner.repository';
@Global()
@Module({
    imports: [MongooseModule.forFeature([{ name: PetOwner.name, schema: PetOwnerSchema }])],
    providers: [PetOwnerRepository],
    exports: [PetOwnerRepository],
})
export class PetOwnerModule {}
