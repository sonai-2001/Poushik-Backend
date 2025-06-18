import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ApiResponse } from '@common/types/api-response.type';
import {
    CategoryListingDto,
    SaveCategoryDto,
    StatusCategoryDto,
    UpdateCategoryDto,
} from '@modules/category/dto/category.dto';
import { CategoryRepository } from '@modules/category/repositories/category.repository';
import { Messages } from '@common/constants/messages';

@Injectable()
export class CategoryService {
    constructor(private readonly categoryRepository: CategoryRepository) {}

    async getAll(body: CategoryListingDto): Promise<ApiResponse> {
        const getAllCategories = await this.categoryRepository.getAllPaginate(body);
        return { message: 'Category fetched successfully.', data: getAllCategories };
    }

    async save(body: SaveCategoryDto): Promise<ApiResponse> {
        const existingCategory = await this.categoryRepository.getByField({
            name: body.name,
            isDeleted: false,
        });
        if (existingCategory) throw new ConflictException('Category already exists!');

        if (body.parentId) {
            const parentCategory = await this.categoryRepository.getByField({
                _id: new Types.ObjectId(body.parentId),
                isDeleted: false,
            });
            if (!parentCategory) throw new BadRequestException('Parent Category not found!');
        }

        const saveCategory = await this.categoryRepository.save(body);
        if (!saveCategory) throw new BadRequestException(saveCategory);

        return { message: 'Data saved successfully.' };
    }

    async get(id: string): Promise<ApiResponse> {
        const category = await this.categoryRepository.getByField({
            _id: new Types.ObjectId(id),
            isDeleted: false,
        });

        if (!category) throw new BadRequestException('Category not found!');
        return { message: 'Category retrieved successfully.', data: category };
    }

    async update(id: string, body: UpdateCategoryDto): Promise<ApiResponse> {
        if (body.parentId && body.removeParentId !== undefined) {
            throw new BadRequestException('You cannot provide both parentId and removeParentId!');
        }

        const categoryToUpdate = await this.categoryRepository.getByField({
            _id: new Types.ObjectId(id),
            isDeleted: false,
        });
        if (!categoryToUpdate) throw new BadRequestException('Category not found!');

        if (body.name) {
            const existingCategory = await this.categoryRepository.getByField({
                name: body.name,
                isDeleted: false,
                _id: { $ne: new Types.ObjectId(id) },
            });

            if (existingCategory) {
                throw new ConflictException('A category with this name already exists.');
            }
        }

        if (body.parentId) {
            const parentCategory = await this.categoryRepository.getByField({
                _id: new Types.ObjectId(body.parentId),
                isDeleted: false,
            });
            if (!parentCategory) throw new BadRequestException('Parent Category not found!');

            if (parentCategory._id.toString() === categoryToUpdate._id.toString())
                throw new BadRequestException('A category cannot be its own parent!');
        }

        body.parentId = body.removeParentId ? null : (body.parentId ?? categoryToUpdate.parentId);

        const updatedValue = {
            name: body.name ?? categoryToUpdate.name,
            description: body.description ?? categoryToUpdate.description,
            parentId: body.parentId,
        };

        const update = await this.categoryRepository.updateById(
            updatedValue,
            new Types.ObjectId(id),
        );
        if (!update)
            throw new BadRequestException(
                update instanceof Error ? update : Messages.SOMETHING_WENT_WRONG,
            );
        return { message: 'Category updated successfully.', data: update };
    }

    async delete(id: string): Promise<ApiResponse> {
        const categoryToDelete = await this.categoryRepository.getByField({
            _id: new Types.ObjectId(id),
            isDeleted: false,
        });
        if (!categoryToDelete) throw new BadRequestException('Category not found!');

        const delData = await this.categoryRepository.updateById(
            { isDeleted: true },
            new Types.ObjectId(id),
        );
        if (!delData)
            throw new BadRequestException(
                delData instanceof Error ? delData : Messages.SOMETHING_WENT_WRONG,
            );

        return { message: 'Category deleted successfully.' };
    }

    async statusUpdate(id: string, body: StatusCategoryDto): Promise<ApiResponse> {
        const categoryToStatusChange = await this.categoryRepository.getByField({
            _id: new Types.ObjectId(id),
            isDeleted: false,
        });
        if (!categoryToStatusChange) throw new BadRequestException('Category not found!');

        const update = await this.categoryRepository.updateById(body, new Types.ObjectId(id));
        if (!update)
            throw new BadRequestException(
                update instanceof Error ? update : Messages.SOMETHING_WENT_WRONG,
            );
        return { message: 'Status updated successfully.', data: update };
    }
}
