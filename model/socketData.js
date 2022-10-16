/**
 * socketData.js
 * @description :: model of a database collection
 */

const mongoosePaginate = require('mongoose-paginate-v2');
const mongoose = require('mongoose');

const myCustomLabels = {
  totalDocs: 'itemCount',
  docs: 'data',
  limit: 'perPage',
  page: 'currentPage',
  nextPage: 'next',
  prevPage: 'prev',
  totalPages: 'pageCount',
  pagingCounter: 'slNo',
  meta: 'paginator',
};

mongoosePaginate.paginate.options = { customLabels: myCustomLabels };

const { Schema } = mongoose;
const schema = new Schema({
  message: String,
  socketId: String,
},
{
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});
schema.pre('save', async function (next) {
  this.isDeleted = false;
  this.isActive = true;
  next();
});

schema.method('toJSON', function () {
  const {
    __v, _id, ...object
  } = this.toObject();
  object.id = _id;
  return object;
});
schema.plugin(mongoosePaginate);
module.exports = mongoose.model('socketData', schema, 'socketData');
