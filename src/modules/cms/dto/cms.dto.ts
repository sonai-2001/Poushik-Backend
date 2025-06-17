import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, TransformFnParams } from "class-transformer"
import { StatusEnum } from "@common/enum/status.enum";
import { SortOrderEnum } from "@common/enum/sort-order.enum";

export class UpdateCmsDto {
    @ApiProperty({ description: 'Content' })
    @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value?.trim() : String(value))
    @IsNotEmpty({ message: 'Content is required' })
    content: string;
}


export class CmsListingDto {
    @ApiPropertyOptional({ default: 1 })
    @IsNumber()
    @Transform(({ value }) => (value ? Number(value) : 1))
    page?: number = 1;

    @ApiPropertyOptional({ default: 10 })
    @IsNumber()
    @Transform(({ value }) => (value ? Number(value) : 10))
    limit?: number = 10;

    @ApiPropertyOptional({ description: "Search..." })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: "Status Filter", enum: StatusEnum })
    @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
    @IsOptional()
    status?: string;

    @ApiPropertyOptional({ description: "Sort Field" })
    @IsString()
    @IsOptional()
    sortField?: string;

    @ApiPropertyOptional({
        description: "Sort Order",
        enum: SortOrderEnum,
    })
    @IsEnum(SortOrderEnum, { message: 'Sort order must be either asc or desc' })
    @IsOptional()
    sortOrder?: string;
}


export class StatusCmsDto {
    @ApiProperty({ description: "Status", required: true, enum: StatusEnum })
    @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
    @IsNotEmpty({ message: "Status is required" })
    status: string;
}