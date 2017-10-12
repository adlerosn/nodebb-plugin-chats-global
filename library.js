"use strict";

var callNothing = function(){};

var INT_MAX = Number.MAX_SAFE_INTEGER;
var INT_MIN = Number.MIN_SAFE_INTEGER;

var db = module.parent.require('./database');
var meta = module.parent.require('./meta');
var user = module.parent.require('./user');
var messaging = module.parent.require('./messaging');
var controllers = require('./lib/controllers');

function pickOrDefault(value, fallback){
    return value?value:fallback;
}

var plugin = {};

plugin.init = function(params, callback) {
    var router = params.router,
    hostMiddleware = params.middleware,
    hostControllers = params.controllers;

    // We create two routes for every view. One API call, and the actual route itself.
    // Just add the buildHeader middleware to your route and NodeBB will take care of everything for you.

    router.get('/admin/plugins/chats-global', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
    router.get('/api/admin/plugins/chats-global', controllers.renderAdminPage);

    meta.settings.get('chats-global', function(nil, configdata){
        plugin.config = {
            chatname: pickOrDefault(configdata.chatname, 'Site-wide Conversation'),
            //image: pickOrDefault(configdata.image, '/assets/uploads/system/touchicon-orig.png'),
        };

        // Never call this, or handle orphaned children yourself:
        //db.deleteObjectField('globalChat', 'room', callNothing);

        var ensureGlobalChatExists = function(err, roomId){
            if(!roomId){
                plugin.getAllUserIds(function(err, uids){
                    messaging.newRoom(0, uids, function(err, newRoomId){
                        db.setObjectField('globalChat', 'room', newRoomId);
                        ensureGlobalChatExists(null, newRoomId);
                    });
                });
                return;
            }
            plugin.config.roomId = roomId;
            plugin.globalUpdate(callNothing);
        };
        db.getObjectField('globalChat', 'room', ensureGlobalChatExists);
    });

    callback();
};

plugin.getAllUserIds = function(callback){
    user.getUidsFromSet('users:joindate', 0, INT_MAX, callback);
}

plugin.getPresentUserIds = function(callback){
    messaging.getUidsInRoom(plugin.config.roomId, 0, INT_MAX, callback);
}

plugin.getAbsentUserIds = function(callback){
    plugin.getPresentUserIds(function(err, present){
        plugin.getAllUserIds(function(err, all){
            if(Array.isArray(all) && Array.isArray(present)){
                // Set difference: all -- present
                callback(null, all.filter(function(uid) { return present.indexOf(uid) < 0; }));
            }else{
                if(Array.isArray(all)){
                    callback('No one present', all)
                }else{
                    callback('Undefined state; delete chat and start over', null)
                }
            }
        })
    })
}

plugin.addAdminNavigation = function(header, callback) {
    header.plugins.push({
        route: '/plugins/chats-global',
        icon: 'fa-globe',
        name: 'Global chat'
    });

    callback(null, header);
};

plugin.globalUpdate = function(callback){
    // Trying to rename room
    messaging.renameRoom(0, plugin.config.roomId, plugin.config.chatname, callNothing);

    // Adding everyone missing to the room
    plugin.getAbsentUserIds(function(err, uids){
        if(Array.isArray(uids) && uids.length > 0){
            // The script has at least one user to add to the group
            messaging.addUsersToRoom(0, uids, plugin.config.roomId,function(err, data){
                if(!err){
                    messaging.addRoomToUsers(plugin.config.roomId, uids, new Date(), function(err, data){
                        // Here, everyone is added
                    })
                }
            })
        }
    })

    callback(null, null);
}

plugin.getRecentChats = function(data, callback){
    plugin.globalUpdate(callNothing);

    // load global chat, set name and put it first
    messaging.getRoomData(plugin.config.roomId, function(err, room){
        if(!err && room){
            var room_arr = data.rooms.filter(function(room){return room.roomId == plugin.config.roomId});
            data.rooms = data.rooms.filter(function(room){return room.roomId != plugin.config.roomId});
            if(room_arr.length>0){
                room = room_arr[0];
            }
            data.rooms.unshift(room);
            room.roomName = plugin.config.chatname;
        }
        callback(null, data);
    })
}

plugin.createdUser = function(uid){
    plugin.globalUpdate(callNothing);
}

module.exports = plugin;
