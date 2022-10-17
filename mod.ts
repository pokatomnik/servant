import { serveDir } from "https://deno.land/std@0.159.0/http/file_server.ts";
import { serve, serveTls } from "https://deno.land/std@0.159.0/http/server.ts";
import { parse } from "https://deno.land/std@0.159.0/flags/mod.ts";
import { posix } from "https://deno.land/std@0.159.0/path/mod.ts";
import qrcode from "https://deno.land/x/qrcode_terminal@v1.1.1/mod.js";

function afterStartListening(useTls: boolean, host: string, port: number) {
  const protocol = useTls ? "https://" : "http://";
  const hostsListening = new Array<string>();

  if (host === "0.0.0.0") {
    const allHosts = Deno.networkInterfaces().reduce((acc, ni) => {
      if (ni.family === "IPv4") {
        acc.push(ni.address);
      }
      return acc;
    }, new Array<string>());
    hostsListening.push(...allHosts);
  } else {
    hostsListening.push(host);
  }

  console.log("Access from mobile:");
  for (const host of hostsListening) {
    const url = `${protocol}${host}:${port}`;
    console.log(url);
    qrcode.generate(url, { size: 10000 });
  }
}

function main() {
  const serverArgs = parse(Deno.args, {
    string: ["port", "host", "cert", "key"],
    boolean: ["help", "dir-listing", "dotfiles", "cors", "verbose"],
    negatable: ["dir-listing", "dotfiles", "cors"],
    default: {
      "dir-listing": true,
      dotfiles: true,
      cors: true,
      verbose: false,
      host: "0.0.0.0",
      port: "4507",
      cert: "",
      key: "",
    },
    alias: {
      p: "port",
      c: "cert",
      k: "key",
      h: "help",
      v: "verbose",
    },
  });
  const port = Number(serverArgs.port);
  const host = serverArgs.host;
  const certFile = serverArgs.cert;
  const keyFile = serverArgs.key;

  if (serverArgs.help) {
    printUsage();
    Deno.exit();
  }

  if (keyFile || certFile) {
    if (keyFile === "" || certFile === "") {
      console.log("--key and --cert are required for TLS");
      printUsage();
      Deno.exit(1);
    }
  }

  const wild = serverArgs._ as string[];
  const target = posix.resolve(wild[0] ?? "");

  const handler = (req: Request): Promise<Response> => {
    return serveDir(req, {
      fsRoot: target,
      showDirListing: serverArgs["dir-listing"],
      showDotfiles: serverArgs.dotfiles,
      enableCors: serverArgs.cors,
      quiet: !serverArgs.verbose,
    });
  };

  const useTls = !!(keyFile && certFile);

  if (useTls) {
    serveTls(handler, {
      port,
      hostname: host,
      certFile,
      keyFile,
    });
  } else {
    serve(handler, { port, hostname: host });
  }
  afterStartListening(useTls, host, port);
}

function printUsage() {
  console.log(`Deno File Server
  Serves a local directory in HTTP.
INSTALL:
  deno install --allow-net --allow-read https://deno.land/std/http/file_server.ts
USAGE:
  file_server [path] [options]
OPTIONS:
  -h, --help          Prints help information
  -p, --port <PORT>   Set port
  --cors              Enable CORS via the "Access-Control-Allow-Origin" header
  --host     <HOST>   Hostname (default is 0.0.0.0)
  -c, --cert <FILE>   TLS certificate file (enables TLS)
  -k, --key  <FILE>   TLS key file (enables TLS)
  --no-dir-listing    Disable directory listing
  --no-dotfiles       Do not show dotfiles
  --no-cors           Disable cross-origin resource sharing
  -v, --verbose       Print request level logs
  All TLS options are required when one is provided.`);
}

if (import.meta.main) {
  main();
}
