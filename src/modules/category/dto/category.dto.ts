import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsOptional,
    IsMongoId,
    IsEnum,
    IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { Types } from 'mongoose';
import { StatusEnum } from '@common/enum/status.enum';
import { SortOrderEnum } from '@common/enum/sort-order.enum';

export class SaveCategoryDto {
    @ApiProperty({ description: 'Name of the category', required: true })
    @Transform(({ value }: TransformFnParams) =>
        typeof value === 'string' ? value?.trim() : String(value),
    )
    @IsNotEmpty({ message: 'Name is required!' })
    name: string;

    @ApiProperty({ description: 'Description of the category', required: true })
    @Transform(({ value }: TransformFnParams) =>
        typeof value === 'string' ? value?.trim() : String(value),
    )
    @IsNotEmpty({ message: 'Description is required' })
    description: string;

    @ApiPropertyOptional({ description: 'Parent category ID (optional)' })
    @IsMongoId({ message: 'ParentId must be a valid ObjectId' })
    @IsOptional()
    parentId?: Types.ObjectId;
}

export class UpdateCategoryDto {
    @ApiPropertyOptional({ description: 'Name of the category' })
    @Transform(({ value }: TransformFnParams) =>
        typeof value === 'string' ? value?.trim() : String(value),
    )
    @IsNotEmpty({ message: 'Name is required!' })
    @IsOptional()
    name: string;

    @ApiPropertyOptional({ description: 'Description of the category' })
    @Transform(({ value }: TransformFnParams) =>
        typeof value === 'string' ? value?.trim() : String(value),
    )
    @IsNotEmpty({ message: 'Description is required' })
    @IsOptional()
    description: string;

    @ApiPropertyOptional({
        description: 'Set to true to remove the parent category',
        example: false,
    })
    @IsBoolean({ message: 'removeParentId must be a boolean value (true or false)' })
    @IsNotEmpty({ message: 'removeParentId is required' })
    @IsOptional()
    removeParentId?: boolean;

    @ApiPropertyOptional({ description: 'Parent category ID (optional)' })
    @IsMongoId({ message: 'ParentId must be a valid ObjectId' })
    @IsNotEmpty({ message: 'ParentId is required' })
    @IsOptional()
    parentId?: Types.ObjectId;
}

export class CategoryListingDto {
    @ApiPropertyOptional({ default: 1 })
    @IsNumber()
    @Transform(({ value }) => (value ? Number(value) : 1))
    page?: number = 1;

    @ApiPropertyOptional({ default: 10 })
    @IsNumber()
    @Transform(({ value }) => (value ? Number(value) : 10))
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Search...' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: 'Status Filter', enum: StatusEnum })
    @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
    @IsOptional()
    status?: string;

    @ApiPropertyOptional({ description: 'Sort Field' })
    @IsString()
    @IsOptional()
    sortField?: string;

    @ApiPropertyOptional({
        description: 'Sort Order',
        enum: SortOrderEnum,
    })
    @IsEnum(SortOrderEnum, { message: 'Sort order must be either asc or desc' })
    @IsOptional()
    sortOrder?: string;

    @ApiPropertyOptional({ description: 'Parent category ID (optional)' })
    @IsMongoId({ message: 'ParentId must be a valid ObjectId' })
    @IsOptional()
    parentId?: Types.ObjectId;
}

export class StatusCategoryDto {
    @ApiProperty({ description: 'Status', required: true, enum: StatusEnum })
    @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
    @IsNotEmpty({ message: 'Status is required' })
    status: string;
}
