const mongoose = require("mongoose");
const validator = require('validator'); 
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema =  new mongoose.Schema({
    email : {
        type: String,
        required: true,
        minLength: 1,
        unique: true,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    name : {
        type: String,
        required: true,
        minLength: 1
    },
    authToken : {
        type: String,
        required: true
    },
    userId : {
        type: String,
        required: true
    },
    tokens: [{
        access: {
            type: String,
            required: true
        },
        token: {
            type: String,
            required: true
        },
        expires: {
            type: Number,
            required: true
        }
    }]
});

UserSchema.methods.toJSON = function () {
    var user = this;
    var userObject = user.toObject();

    return _.pick(userObject, ['_id', 'email','name']);

}

UserSchema.methods.generateAccessToken = function (exp) {
    var user = this;
    var access = 'auth';
    var expires = exp;
    var token = jwt.sign({authToken: user.authToken, userId: user.userId, expires},  process.env.JWT_SECRET);

    user.tokens = user.tokens.concat([{access, token, expires}]);

    return user.save().then(() => {
        return token;
    });
};

UserSchema.methods.removeToken = function(token) {
    var user = this;
    
    return user.update({
        $pull: {
            tokens: {
                token
            }
        }
    })
}

UserSchema.statics.findByToken = function(token) {
    var User = this;

    var decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    }catch(e) {
        return Promise.reject()
    }

    return User.findOne({
        authToken: decoded.authToken,
        'tokens.token': token,
        'tokens.access': 'auth'
    });

}

UserSchema.statics.findByUserId = function(id) {
    var User = this;

    return User.findOne({userId:id});
}

UserSchema.statics.findByCredentials = function (email) {
    var User = this;

    return User.findOne({email}).then((user) => {
        if (!user) {
            return Promise.reject()
        }
    })
}

// UserSchema.pre('save', function(next) {
//     var user = this;
//     var password = user.password;

//     if(user.isModified('password')) {
//         bcrypt.genSalt(10, (err, salt) => {
//             bcrypt.hash(password, salt, (err, hash) => {
//                 user.password = hash;
//                 next(); 
//             });   
//         });
        
//     }else{
//         next();
//     }
// });

var User = mongoose.model('User', UserSchema);

module.exports = {User}