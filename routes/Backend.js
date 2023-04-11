const express = require("express")
const API = new express.Router()
const cors = require("cors")
const jwt  = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { MongoClient, ObjectID } = require('mongodb')
const Pusher = require("pusher");

const url = 'mongodb+srv://chatlol:OXOW6QHFnCncBmAt@chatlol.ypfjw7n.mongodb.net/test';
const client = new MongoClient(url);

const dbName = 'chat'

const db = client.connect()

const database = client.db(dbName)

const Accounts = database.collection('Users')

const Chat = database.collection('Chat')

const Messages = database.collection('Messages')

const pusher = new Pusher({
  appId: "1566333",
  key: "e86182d2a73442b1e80b",
  secret: "8788aa47dd8ec39101ae",
  cluster: "eu",
  useTLS: true
});

API.use(cors())

process.env.SECRET_KEY = 'secret'

// Account API
API.post('/account/register', (req, res) => {
    const today = new Date();
    const userData = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      sex: req.body.sex,
      created: today,
      coins: 10,
      role: 'user'
    }
    
    Accounts.find({ email: req.body.email }).toArray()
    .then(account => {
    if(account == "") {
      bcrypt.hash(req.body.password, 10, (err, hash) => {
        userData.password = hash
        Accounts.insertOne(userData)
        .then(accounta => {
          Accounts.find({ _id: accounta.insertedId }).toArray()
          .then(accounts => {
            let token = jwt.sign(accounts[0], process.env.SECRET_KEY, {
              expiresIn: 1440000
            })
            res.send(token)
          })
        })
        .catch(err => {
          res.send("error: " + err)
        })
      })
    }else {
      res.json({ error: "Email address or Username is taken." })
    }
  })
})

API.post('/account/login', (req, res) => {
    Accounts.find({ username: req.body.username }).toArray()
    .then(account => {
      if(bcrypt.compareSync(req.body.password, account[0].password)){
        let token = jwt.sign(account[0], process.env.SECRET_KEY, {
            expiresIn: 1440000
        })
        res.send(token)
      }else{
        res.status(400).json({error: 'User Does Not Exist'})
      }
    })
    .catch(err => {
      res.status(400).json({ error: err })
    })
})

API.post('/accounts/username/check', (req, res) => {
  Accounts.find({ username: req.body.username }).toArray()
  .then(account => {
    if(account == ""){
      res.status(200).send('username is available')
    }else{
      res.status(400).send('username is already in use')
    }
  })
})

API.post('/account/avatar/update', (req, res) => {
  Accounts.updateOne({ _id: ObjectId(req.body.id) }, { $set: { avatar: req.body.avatar } })
  .then(account => {
    res.send(account)
  })
})

API.post('/account/loggedin', (req, res) => {
  let now = new Date();
  let tenMinutesLater = new Date(now.getTime() + 9 * 60000);
  Accounts.updateOne({ _id: ObjectId(req.body.id) }, { $set: { logged_in: tenMinutesLater } })
  .then(() => {
    pusher.trigger("chat", "member", {
      message: 'online'
    });
  })
})

API.post('/account/get/online', (req, res) => {
  Accounts.find({ logged_in: { $gt: new Date() } }).toArray()
  .then(accounts => {
    res.send(accounts)
  })
})

API.post('/account/me', (req, res) => {
  Accounts.find({ _id: ObjectId(req.body.id) }).toArray()
  .then(account => {
    res.send(account[0])
  })
})

API.post('/chat/send', (req, res) => {
  const today = new Date();
  const messageData = {
    _id: new ObjectID(),
    room_id: '',
    user: req.body.user,
    msg: req.body.msg,
    time: today,
    type: 'text'
  }
  Chat.insertOne(messageData)
  .then(() => {
    Accounts.updateOne({ _id: ObjectId(req.body.user._id) }, { $inc: { coins: +2 } })
    .then(() => {
      //pusher trigger for Chat Sent
      pusher.trigger("chat", "sent", {
        messageData
      });
      res.send(messageData)
    })
  })
  .catch(err => {
    res.send("error: " + err)
  })
})

API.post('/chat/get', (req, res) => {
  Chat.find({ type: 'text' }).sort({time: -1}).limit(10).toArray()
  .then(chat => {
    res.send(chat)
  })
})

API.get('/chat/unsubscribe/:id', (req, res) => {
  const id = req.params.id;
  pusher.trigger("chat", "unsubscribe", {
    user_id: id
  });
  Accounts.updateOne({ _id: ObjectId(req.body.id) }, { $set: { logged_in: new Date() } })
  .then(() => {
    res.send('unsubscribed')
  })
});

API.post('/pusher/auth', (req, res) => {
  const channelName = 'chat';
  const user = {
    id: req.query.user.id,
    user_info: {
      name: req.query.user.id,
    },
  };
  const authResponse = pusher.authenticateUser(socketId, user);
  console.log(authResponse)

  
pusher.get({ path: `/channels/${channelName}/members` })
.then((response) => {
  const members = response.members;
  const customMemberIds = members.filter((member) => {
    return member.id === 'CUSTOM_MEMBER_ID';
  }).map((member) => {
    return member.id;
  });
  console.log('Custom member IDs:', customMemberIds);
})
.catch((error) => {
  console.error('Error:', error);
})
});

API.post('/chat/type/update', (req, res) => {
  Chat.updateMany({  }, { $set: { type: 'text' } })
  .then(() => {
    res.send('updated')
  })
})

API.post('/chat/command', (req, res) => {
  const msg = req.body.msg
  pusher.trigger("chat", "command", {
    msg
  })
  .then(() => {
    res.send(req.body.msg)
  })
})

API.post('/chat/gift', (req, res) => {
  const amount = req.body.msg.amount 
  Accounts.updateOne({ _id: ObjectId(req.body.msg.commandUser._id) }, { $inc: {coins: +amount} })
  .then(() => {
    Accounts.updateOne({ _id: ObjectId(req.body.msg.user._id) }, { $inc: { coins: -amount} })
    .then(() => {
        const msg = req.body.msg
        pusher.trigger("chat", "command", {
          msg
        })
        .then(() => {
          res.send(req.body.msg)
        })
      })
    })
})


API.post('/chat/kick', (req, res) => {
  pusher.trigger("chat", "kick", {
    user_id: req.body.id
  })
  .then(() => {
    res.send('kicked')
  })
})

API.post('/chat/private/send', (req, res) => {
  const msg = {
    _id: new ObjectID(),
    sender_id: req.body.sender_id,
    receiver_id: req.body.receiver_id,
    msg: req.body.msg,
    time: new Date(),
    status: 'unread'
  }
  Messages.insertOne(msg)
  .then(() => {
    Accounts.updateOne({ _id: ObjectId(req.body.sender_id) }, { $inc: { coins: -1 } })
    .then(() => {
      pusher.trigger('chat', 'private', {
        message: msg
      })
      .then(() => {
        res.send(msg)
      })
    })
  })
})

module.exports = API