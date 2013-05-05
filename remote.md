## Remote control protocol

The remote control protocol enables local software to control musicdweb to implement features such as global hotkeys, just like in a desktop music player.

When remote control is enabled, musicdweb attempts to connect to the static URL "http://localhost:48278/events". This URL is expected to return a [server-sent events](http://www.w3.org/TR/eventsource/) stream. The only supported event type is "command" and its data field is expected to be a command for the player. The supported commands are:

* togglePlay
* play
* pause
* stop
* prev
* next
* rewindOrPrev

In addition, upon connection to the event stream and whenever the state of the player changes, the state is reported by a POST request to http://localhost:48278/state/STATE where STATE is one of the following:

* stop
* pause
* play

A working implementation of a remote control application with global hotkey support is available at https://github.com/mvirkkunen/musicdwebremote
