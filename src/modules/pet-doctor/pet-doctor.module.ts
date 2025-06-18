// src/modules/pet-doctor/pet-doctor.module.ts

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PetDoctorRepository } from './pet-doctor.repository';
import { PetDoctor, PetDoctorSchema } from './pet.doctor.schema';
@Global()
@Module({
    imports: [MongooseModule.forFeature([{ name: PetDoctor.name, schema: PetDoctorSchema }])],
    providers: [PetDoctorRepository],
    exports: [PetDoctorRepository],
})
export class PetDoctorModule {}
