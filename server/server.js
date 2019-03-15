
const _ = require('lodash');
const cors = require('cors');
const FB = require('fb').default;
const express = require('express');
const bodyParser = require('body-parser');

var {User} = require('./models/user');
const { authenticate } = require('./middleware/authenticate');
require('./config/config');
var {mongoose} = require('./db/mongoose');


var app = express();

// const corsOptions = {
//     origin: '*',
//     exposedHeaders: ['content-type','x-auth'],
//     allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'x-auth']
// };

// app.use(cors(corsOptions));

app.use(bodyParser.json());

FB.options({version: 'v3.2'});

const port = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');	
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-auth');	
    res.header('Access-Control-Expose-Headers', 'x-auth');	
    next();	
});

app.post('/users', async (req, res, next) => {
    try{
        const body = _.pick(req.body, ['email', 'name', 'authToken', 'id']);
        console.log(body)
        // const results = await FB.api('oauth/access_token', {
        //     client_id: process.env.APP_ID,
        //     client_secret: process.env.APP_SECRET,
        //     grant_type: 'fb_exchange_token',
        //     fb_exchange_token: body.authToken
        // });
    
        // const accessToken = results.access_token;
        // const expires = results.expires_in ? results.expires_in : 0;
        // const userDetails = {
        //     email: body.email,
        //     name: body.name,
        //     authToken: accessToken,
        //     userId: body.id
        // }

        // const query = {userId: body.id};
        // await User.findOneAndUpdate(query, userDetails, {upsert: true}, async function(err, doc){
        //     if (err) {
        //         console.log(err);
        //         return
        //     };
        //     const user = await User.findByCredentials(body.email);

        //     var expiryDate = new Date();
        //     expiryDate.setSeconds(expiryDate.getSeconds() + expires);
        //     const token = await user.generateAccessToken(expiryDate);
        //     console.log(token)
        //     res.header('x-auth', token).send(user);
        // });
        
    }catch(e) {
        next(e)
    }
    
});

app.get('/adaccounts', authenticate, async (req,res, next) => {
    try{
        const id = req.user.userId;
        const list = await FB.api(`/${id}/adaccounts?fields=name,account_status`, {
        access_token: req.user.authToken
        });
        res.send(list);
    }catch(e) {
        next(e)
    }
});

app.get('/campaigns/:id', authenticate, async (req,res, next) => {
    try{
        const id = req.params.id;
        const list = await FB.api(`/${id}/campaigns?fields=name&effective_status[]=ACTIVE`, {
        access_token: req.user.authToken
        });
        res.send(list);
    }catch(e) {
        next(e)
    }
});

app.get('/adsets/:id', authenticate, async (req,res, next) => {
    try {
        const id = req.params.id;
        const list = await FB.api(`/${id}/adsets?fields=name`, {
            access_token: req.user.authToken
        });
        res.send(list);
    }catch(e) {
        next(e)
    }
});

app.get('/ads/:id', authenticate, async (req,res,next) => {
    try{
        const id = req.params.id;
        const list = await FB.api(`/${id}/ads?fields=name`, {
        access_token: req.user.authToken
        });
        res.send(list);
    }catch(e) {
        next(e)
    }
});

app.get('/stats/:id', authenticate, async (req,res, next) => {
    try{
        const id = req.params.id;
        const stats = await FB.api(`/${id}/keywordstats?fields=impressions,clicks,cpc,ctr,spend,reach`, {
        access_token: req.user.authToken
        });
        res.send(stats);
    }catch(e) {
        next(e)
    }
    
    
});

app.get('/up', (req,res,next) => {
    res.send('App is up');
});

app.use((err, req, res, next) => {
    if(err){
        console.log(err)
        res.status(400).send(err);
    }

})



app.listen(port, ()=> {
    console.log(`Server started on port ${port}`);
});

module.exports = {app}
