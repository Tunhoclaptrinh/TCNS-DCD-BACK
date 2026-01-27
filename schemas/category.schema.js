module.exports = {
  name: {
    type: 'string',
    required: true,
    unique: true,
    minLength: 2,
    maxLength: 50
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 200
  }
};
