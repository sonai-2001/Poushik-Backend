// src/modules/pet-seller/schemas/pet-seller.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class PetSeller {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId; // Link to User._id

    @Prop({ required: true }) phone: string;

    @Prop({ required: true }) storeName: string;

    @Prop({ required: true }) storeAddress: string;

    @Prop({ required: true }) businessLicense: string;

    @Prop({ required: true }) licenseDocument: string;

    @Prop({ type: [String], default: [] }) images?: string[];
}

export type PetSellerDocument = PetSeller & Document;
export const PetSellerSchema = SchemaFactory.createForClass(PetSeller);
