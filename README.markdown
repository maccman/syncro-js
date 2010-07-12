This is the JavaScript client library to [syncro](http://github.com/maccman/syncro)

Syncro-js opens a WebSocket connection to your Syncro server and will sync state between the two.


Examples:

    <script src="jquery.js" type="text/javascript" charset="utf-8"></script>
    <script src="superclass.js" type="text/javascript" charset="utf-8"></script>
    <script src="supermodel.js" type="text/javascript" charset="utf-8"></script>
    <script src="jquery.js" type="text/javascript" charset="utf-8"></script>
    
    <script type="text/javascript" charset="utf-8">
      // Model
      var User = SuperModel.setup("User");
      User.attributes = ["name"];

      User.extend(SuperModel.Marshal);
      User.extend(Syncro.Model);

      // Connection
      Syncro.afterConnect(function(){
        console.log("Connected");
      });

      Syncro.connect("ws://syncro_server");
    </script>


For information on SuperClass visit its [project](http://github.com/maccman/superapp) page.

For information on SuperModel visit its [project](http://github.com/maccman/supermodel-js) page.