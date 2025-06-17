import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class RegistrationSession extends Document {
  @Prop({ required: true }) regToken: string;
  @Prop({ required: true }) email: string;
  @Prop({ required: true }) fullName: string;
  @Prop({ required: true }) password: string;
  @Prop({ required: true }) role: string; // 'pet-owner' | 'pet-doctor' | 'seller'
  @Prop() profileImage?: string;

  @Prop({ default: 'step1' }) step: string;
  @Prop({ required: true }) expiresAt: Date;

  // ✅ Step 2: Pet Owner
  @Prop({ type: Object }) petOwnerData?: {
    phone: string;
    address: string;
    pets: {
      name: string;
      type: string;
      breed: string;
      imageName?: string;
    }[];
  };

  // ✅ Step 2: Pet Doctor
  @Prop({ type: Object }) petDoctorData?: {
    phone: string;
    clinicName: string;
    clinicAddress: string;
    specialization: string;
    licenseNumber: string;
    licenseDocument: string; // uploaded file name
    images?: string[];
  };

  // ✅ Step 2: Seller
  @Prop({ type: Object }) sellerData?: {
    phone: string;
    storeName: string;
    businessLicense: string;

    licenseDocument: string;
    images?: string[];
  };


  @Prop({ default: false }) step2Completed: boolean;
}

export const RegistrationSessionSchema = SchemaFactory.createForClass(RegistrationSession);

// TTL index for expiration
RegistrationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
