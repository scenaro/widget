function installScenaroStub(root) {
  if (root.Scenaro) return;
  var pending = [];
  var timer = 0;
  var waitMs = 15000;

  function flush() {
    var api = root.Scenaro;
    if (!api || api._stub || !api._initialized) return false;
    var calls = pending.splice(0, pending.length);
    for (var i = 0; i < calls.length; i++) {
      var fn = api[calls[i][0]];
      if (typeof fn !== "function") continue;
      try {
        fn.apply(api, calls[i][1]);
      } catch (error) {
        console.error("[Scenaro] queued " + calls[i][0] + " failed", error);
      }
    }
    return true;
  }

  function schedule() {
    if (timer) return;
    var start = Date.now();
    timer = setInterval(function () {
      if (flush() || Date.now() - start > waitMs) {
        clearInterval(timer);
        timer = 0;
        if (pending.length) {
          console.error("[Scenaro] widget did not become ready");
          pending.length = 0;
        }
      }
    }, 50);
  }

  function enqueue(name) {
    return function () {
      var args = [];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      pending.push([name, args]);
      if (!flush()) schedule();
    };
  }

  root.Scenaro = {
    _stub: true,
    open: enqueue("open"),
    close: enqueue("close"),
    on: enqueue("on"),
    off: enqueue("off"),
    updateMetadata: enqueue("updateMetadata"),
  };
}
