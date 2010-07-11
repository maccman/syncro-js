Syncro = new SuperClass();

Syncro.Utils = new SuperClass();
Syncro.Utils.extend({
  camelize: function(str){
    var result = str;
    result = result.replace(/_+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
    result = result.replace(/(^.)?/, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });  
    return result;
  },
  
  singularize: function(str){
    return(str.replace(/s$/, ''));
  },
  
  classify: function(str){
    var result = this.singularize(str);
    return this.camelize(result);
  },
  
  constantize: function(str){
    return(eval(str.valueOf()));
  },
  
  isEmpty: function(obj){
    // if false/nil
    if ( !obj ) 
      return true;
    
    // if array
    if (typeof obj.length == "number")
      return(obj.length == 0);
    
    // if hash/object
    var i = 0;
    for (var k in obj) i ++;
    return(i == 0);
  }
});

Syncro.extend({
  trace:  true,
  closed: false,
  
  _afterConnect: [],
  afterConnect: function(cb){
    if (typeof cb == "function") this._afterConnect.push(cb);
    else if (cb) 
      for (var i in this._afterConnect) 
        this._afterConnect[i]();
  },
  
  _afterClose: [],
  afterClose: function(cb){
    if (typeof cb == "function") this._afterClose.push(cb);
    else if (cb) 
      for (var i in this._afterClose) 
        this._afterClose[i]();
  },
    
  connect: function(address){
    if (address)  this.address  = address;
    this.socket           = new WebSocket(this.address);
    this.socket.onopen    = this.proxy(this.onopen);
    this.socket.onmessage = this.proxy(this.onmessage);
    this.socket.onclose   = this.proxy(this.onclose);
  },
    
  disconnect: function(){
    this.closed = true;
    if (this.socket)
      this.socket.close()
  },
  
  onopen: function(){
    this.log("Syncro connected to " + this.address);
    this.afterConnect(true);
  },
  
  onmessage: function(e){
    this.log("Receiving: " + e.data);
    this.receiveMessage(this.Message.fromJSON(e.data));
  },
  
  onclose: function(){
    this.afterClose(true);
    if ( !this.closed )
      this.timeout = setTimeout(this.proxy(this.connect), 5000);
  },
    
  receiveMessage: function(msg){
    this.App.receiveMessage(msg);
  },
  
  isConnected: function(){
    return(this.socket && 
           this.socket.readyState == this.socket.OPEN);
  },
  
  sendMessage: function(msg){
    if (!this.socket) throw 'Connect first';
    if (!this.isConnected()) return;
    var data = msg.toJSON();
    this.log("Sending: " + data);
    this.socket.send(data);
  },
  
  scribeID: function(data){
    if (typeof data != "undefined") 
      localStorage.setItem("scribeID", data);
    return localStorage.getItem("scribeID");
  },
  
  reset: function(){
    this.disconnect();
    SuperClass.marshalEnabled = false;
    localStorage.removeItem("scribeID");
    this.log("Reset");
  },
  
  disabled: 0,
  
  disable: function(proc){
    this.disabled += 1;
    proc();
    this.disabled -= 1;
  },
  
  isDisabled: function(){
    return(this.disabled > 0);
  },
  
  log: function(){
    if ( !this.trace ) return;
    if (typeof console == "undefined") return;
    var args = jQuery.makeArray(arguments);
    args.unshift("(Syncro)");
    console.log.apply(console, args);
  }
});

Syncro.Message = function(hash){
  for (var key in hash) this[key] = hash[key];
};

Syncro.Message.fromJSON = function(json){
  var object  = JSON.parse(json);
  var message = new this;
  for(var key in object) 
    message[key] = object[key];
  return message;
};

Syncro.Message.prototype.toJSON = function(){
  var object = {};
  for (var key in this) {
    if (typeof this[key] != "function")
      object[key] = this[key];
  }
  return(JSON.stringify(object));
};

Syncro.App = new SuperClass();
Syncro.App.extend({
  receiveMessage: function(msg){
    this.message = msg;
    var func     = this["invoke_" + this.message.type];
    if (func) func.apply(this);
  },
  
  sync: function(callback){
    this.invoke("sync", {from:Syncro.scribeID()}, function(result){
      var scribes = jQuery.map(result, function(scribe){
        return(new Syncro.Scribe(scribe));
      });
            
      for (var i in scribes) 
        scribes[i].play();
      
      if (scribes.length > 0) 
        Syncro.scribeID(scribes[scribes.length - 1].id);
        
      if (callback) callback();
    });
  },
  
  addScribe: function(scribe, cb){
    this.invoke("add_scribe", {scribe:scribe.attributes()}, cb);
  },
  
  // rpc(klass, method, arg1, arg2, cb);
  rpc: function(){
    var args   = jQuery.makeArray(arguments);
    var klass  = args.shift();
    var method = args.shift();
    
    var callback  = args.pop();
    if( !typeof(callback) == "function"){
      args.push(callback);
    }
    
    this.invoke("rpc", 
      {
        klass:klass, 
        method:method, 
        args:args
      }, 
      callback
    );
  },
  
  uptodate: function(){
    this.rpc(
      "Syncro::RPC::Default", 
      "last_scribe_id", 
      function(id){
        Syncro.scribeID(id);
      }
    );
  },
    
  // Private:
  
  invoke_sync: function(){
    var result = Syncro.Scribe.since(
      this.message.from
    );
    this.respond(result);
  },
  
  invoke_add_scribe: function(){    
    var scribe = new Syncro.Scribe(
      this.message.scribe
    );
    scribe.play();
    this.respond(true);
    Syncro.scribeID(scribe.id);
  },
  
  invoke_response: function(){
    this.invokeResponse(
      this.message.id, 
      this.message.result
    );
  },
  
  invoke_error: function(){
    Syncro.reset();
    if (typeof console != "undefined")
      console.error("Syncro error: " + this.message.code);
  },
  
  // Public:
  
  invoke: function(type, hash, cb){
    var message = new Syncro.Message(hash);
    message.type = type;
    message.id   = this.generateID();
    this.expectResponse(message.id, cb);
    Syncro.sendMessage(message);
  },
  
  respond: function(res){
    var message = new Syncro.Message();
    message.type = "response";
    if (this.message)
      message.id = this.message.id;
    message.result = res;
    Syncro.sendMessage(message);
  },
  
  error: function(code){
    var message  = new Syncro.Message();
    message.type = "error";
    message.code = code || 0;
    Syncro.sendMessage(message);
  },
  
  // Private:
  
  generateID: function(){
    if (!this.id) this.id = 0;
    return(this.id += 1);
  },
  
  callbacks: {},
  
  expectResponse: function(msgID, cb){
    this.callbacks[msgID] = cb;
  },
  
  invokeResponse: function(msgID, result){
    var callback = this.callbacks[msgID];
    delete this.callbacks[msgID];
    if (callback) callback.call(callback, result);
  }
});

Syncro.Scribe = SuperModel.setup("Scribe");
Syncro.Scribe.attributes = ["klass", "type", "data", 
                            "clients"];

Syncro.Scribe.extend({
  since: function(id){
    return(this.select(function(scribe){
      return Number(scribe.id) > Number(id);
    }));
  }
});

Syncro.Scribe.include({
  instance: function(){
    try {
      var klassName = Syncro.Utils.classify(this.klass);
      return Syncro.Utils.constantize(klassName);
    } catch(e) {
      Syncro.log(this.klass + " not found");
      return false;
    }
  },
  
  play: function(){
    var instance = this.instance();
    if (instance && instance.scribePlay) 
        instance.scribePlay(this);
  }
});

Syncro.Scribe.extend(SuperModel.Marshal);

Syncro.Scribe.afterCreate(function(scribe){
  Syncro.App.addScribe(scribe);
});

Syncro.Model = {
  extended: function(base){
    Syncro.expose(base);
    Syncro.observe(base);
  }
};

Syncro.expose = function(base){
  base.extend({    
    scribePlay: function(scribe){
      Syncro.disable(this.proxy(function(){
        var func = "scribePlay_" + scribe.type;
        if (this[func]) this[func](scribe);
      }));
    },
    
    scribePlay_create: function(scribe){      
      this.create(scribe.data);
    },
    
    scribePlay_update: function(scribe){
      var record = this.find(scribe.data[0]);
      record.updateAttributes(scribe.data[1]);
    },
    
    scribePlay_destroy: function(scribe){
      this.destroy(scribe.data[0]);
    }
  });
};

Syncro.observe = function(base) {
  base.extend({
    record: function(type, options){
      if (Syncro.isDisabled()) return;
      if (!options) options = {};
      options.klass = base.className;
      options.type  = type;
      Syncro.Scribe.create(options);
    }
  });
  
  base.afterCreate(function(rec){
    base.record("create", {
      data: rec.attributes()
    });
  });
  
  base.afterUpdate(function(rec){
    var changes   = rec.previousChanges;
    var changedTo = {};
    for (var key in changes)
      changedTo[key] = changes[key][1];
    
    // No changes
    if (Syncro.Utils.isEmpty(changedTo)) return;
    
    base.record("update", {
      data: [rec.id, changedTo]
    });
  });
  
  base.afterDestroy(function(rec){
    base.record("destroy", {
      data: [rec.id]
    });
  })
};

// KeepAlive support

Syncro.App.extend({
  noop: function(cb){
    this.invoke("noop", {}, cb);
  }
});

Syncro.keepAlive = new SuperClass;
Syncro.keepAlive.extend({
  interval: null,
  
  setup: function(){
    Syncro.afterConnect(this.proxy(this.start));
    Syncro.afterClose(this.proxy(this.stop));
  },
  
  start: function(){
    this.interval = setInterval(this.proxy(function(){
      this.checkAlive();
    }), 30000);
  },
  
  stop: function(){
    clearInterval(this.interval);
  },
  
  checkAlive: function(inter){
    var alive = false;
    
    setTimeout(this.proxy(function(){
      if ( !alive ) Syncro.onclose();
    }), 4000);
    
    Syncro.App.noop(function(){
      alive = true;
    });
  }
});
Syncro.keepAlive.setup();