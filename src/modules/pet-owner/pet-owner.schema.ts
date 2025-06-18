// src/modules/pet-owner/schemas/pet-owner.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PetOwner {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    phone: string;

    @Prop({ required: true })
    address: string;

    @Prop([
        {
            name: { type: String, required: true },
            type: { type: String, required: true },
            breed: { type: String, required: true },
            imageName: { type: String, required: false },
        },
    ])
    pets: {
        name: string;
        type: string;
        breed: string;
        imageName?: string;
    }[];
}

export type PetOwnerDocument = HydratedDocument<PetOwner>;
export const PetOwnerSchema = SchemaFactory.createForClass(PetOwner);
