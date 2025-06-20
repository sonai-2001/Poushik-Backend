import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class MongoIdPipe implements PipeTransform {
    transform(value: any) {
        if (!isValidObjectId(value)) {
            throw new BadRequestException('The provided id is not a valid MongoDB ObjectId.');
        }
        return value;
    }
}
