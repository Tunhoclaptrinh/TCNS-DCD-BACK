module.exports = {
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  email: {
    type: 'email',
    required: true,
    unique: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 6
  },
  role: {
    type: 'enum',
    enum: ['user', 'admin'],
    default: 'user'
  }
};
