const axios = require('axios');
const _ = require('lodash');
const FB = require('fb').default;
const express = require('express');
const bodyParser = require('body-parser');

const {User} = require('./models/user');
const { authenticate } = require('./middleware/authenticate');
require('./config/config');
var {mongoose} = require('./db/mongoose');

var app = express();

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
        const results = await FB.api('oauth/access_token', {
            client_id: process.env.APP_ID,
            client_secret: process.env.APP_SECRET,
            grant_type: 'fb_exchange_token',
            fb_exchange_token: body.authToken
        });
    
        const accessToken = results.access_token;
        const expires = results.expires_in ? results.expires_in : 0;
        const userDetails = {
            email: body.email,
            name: body.name,
            authToken: accessToken,
            userId: body.id
        }

        const query = {userId: body.id};
        User.findOneAndUpdate(query, userDetails, {upsert: true}, async function(err, doc){
            if (err) {
                console.log(err);
                return
            };
            const user = await User.findByCredentials(body.email);

            var expiryDate = new Date();
            expiryDate.setSeconds(expiryDate.getSeconds() + expires);
            const token = await user.generateAccessToken(expiryDate);
            res.header('x-auth', token).send(user);
        });
        
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

app.post('/verify-payment', authenticate, async (req, res, next) => {
    try {
        const body = _.pick(req.body, ['plan', 'ref', 'id']);
        const url = 'https://api.ravepay.co/flwv3-pug/getpaidx/api/v2/verify';
        const response = await axios.post(url, {
            "SECKEY": process.env.RAVE_KEY,
            "txref": body.ref
        });
        if (response.data.data.status === "successful" && response.data.data.chargecode == 00) {
            const data = response.data.data;
            if (data.amount == 20 && body.plan === "monthly") {
                console.log("Payment successful for monthly plan");

                // const date = new Date();
                // const nextPayment = date.setTime( date.getTime() + 30 * 86400000 );

                const userDetails = {
                        'plan.name': 'monthly',
                        'plan.customerId': data.customerid,
                        'plan.planId': data.paymentplan
                }

                const query = {userId: body.id}
                
                User.findOneAndUpdate(query, userDetails, { upsert: true}, async (err, doc) => {
                    if (err) {
                        console.log(err)
                        res.send(err)
                        return
                    }else {
                        const user = await User.findByUserId(body.id);
                        res.send(user);
                        console.log(user)
                    }
                })
                
            }else if (data.amount == 140 && body.plan === "yearly") {
                console.log("Payment successful for yearly plan");
                const date = new Date();
                const nextPayment = date.setTime( date.getTime() + 30 * 86400000 );

                const userDetails = {
                    plan: {
                        name: 'yearly',
                        customerId: data.customerid,
                        planId: data.paymentplan
                    }
                }
                const query = {userId: body.id}
                User.findOneAndUpdate(query, userDetails, { upsert: true}, async (err, doc) => {
                    if (err) {
                        console.log(err)
                        res.send(err)
                        return
                    }else {
                        const user = await User.findByUserId(body.id);
                        res.send(user);
                    }
                });
            }else {
                res.status(400).send('Unable to make payment');
            }
            
        }
    } catch(e) {
        console.log(e);
        res.status(400).send(e)
    }
});

app.get('/get-user', authenticate, (req, res, next) => {
    try {
        const user = req.user;
        res.send(user)
    } catch(e) {
        res.status(400).send(e)
    }
});

app.post('/payment-webhook', async (req, res, next) => {
    try {
        var hash = req.headers["verif-hash"];

        if(!hash) {
            return
        }

        const secret_hash = process.env.RAVE_HASH;
        if(hash != secret_hash) {
            return
        }
        const date = new Date();
        const nextPayment = date.setTime( date.getTime() + 30 * 86400000 );

        const userDetails = {
            'plan.nextPayment': nextPayment
        }

        const userEmail = req.body.customer.email;
        const query = {email: userEmail};

        User.findOneAndUpdate(query, userDetails, { upsert: true}, async (err, doc) => {
            if (err) {
                return
            }else {
                console.log('doc', doc)
                const user = await User.findByCredentials(userEmail);
                console.log('the user',user);
            }
        });
        
    } catch(e) {
        console.log(e);
    }
});

app.get('/search', authenticate, async (req,res) => {
    try {
        const user = req.user;
        const query = {userId: user.userId};
        User.findOneAndUpdate(query, { $inc: { search: 1 }}, {upsert: false}, async function(err, doc){
            if (err) {
                console.log(err);
                return
            };
            const response = await User.findByCredentials(user.email);
            // console.log(response)
            res.send(response);
        });
    } catch(e) {
        res.status(400).send(e)
    }
});

app.get('/up', (req,res) => {
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
