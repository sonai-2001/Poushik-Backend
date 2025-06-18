// src/modules/pet-doctor/schemas/pet-doctor.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class PetDoctor {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId; // Link to User._id

    @Prop({ required: true }) phone: string;

    @Prop({ required: true }) clinicName: string;

    @Prop({ required: true }) clinicAddress: string;

    @Prop({ required: true }) specialization: string;

    @Prop({ required: true }) licenseNumber: string;

    @Prop({ required: true }) licenseDocument: string;

    @Prop({ type: [String], default: [] }) images?: string[];
}

export type PetDoctorDocument = PetDoctor & Document;
export const PetDoctorSchema = SchemaFactory.createForClass(PetDoctor);
