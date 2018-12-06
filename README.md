![](https://raw.githubusercontent.com/dupstream/docker/master/img/dupstream-logo-small-w.png)

## dupstream

Dynamic upstream helper for your load balancer. It will automatically generate your upstream file and also will update your server's hosts file.

## What is it for?

dupstream will help you to send your service, task and node list to service url. For example;

Let's say you added a new service to your docker swarm (and you are using multi-host). Overlay network won't work always as you expected. It will make you crazy 🙂 (We have been there!). So old techs and images won't work too... 

Good news!

The application will handle the request something like this;

```json
{
  "nodes": [
    {
      "Id": "xvvpn493yqrvtove74o33o9sf",
      "Name": "docker-node-01",
      "Ip": "192.168.1.5"
    }
  ],
  "services": [
    {
      "Name": "nginx",
      "Ports": [
        {
          "TargetPort": 80,
          "PublishedPort": 9099
        }
      ],
      "Nodes": [
        "xvvpn493yqrvtove74o33o9sf"
      ],
      "Labels": {
        "dupstream.upstream.prefix": "ip_hash;",
        "dupstream.upstream.suffix": "keepalive 32;"
      }
    },
    {
      "Name": "redis",
      "Ports": [
        {
          "TargetPort": 6397,
          "PublishedPort": 2222
        }
      ],
      "Nodes": [
        "xvvpn493yqrvtove74o33o9sf"
      ],
      "Labels": {}
    }
  ]
}
```

Your `http://app-address/lb` will handle the requests and generate upstream file something like this;

```
upstream nginx {
  ip_hash;

  server	docker-node-01:9099;

  keepalive 32;
}

upstream redis {
    server	docker-node-01:2222;
}
```

and hosts file will be updated like this;

```
# <HOST-CONFIG>
192.168.1.5    docker-node-01
# </HOST-CONFIG>
```

You can use service labels (on Docker for example) for managing upstream suffix and prefix.

`dupstream.upstream.prefix` for Upstream Prefix and `dupstream.upstream.suffix` for Upstream Suffix. Also you can ignore a service with `dupstream.ignore` label. Also you can define a service upstream file location with `dupstream.file` (this attributes only allows you to name binding not the file).

You will also have a config file which is "config.json". You can modify it as you wish. Here is the configuration table.

|Name|Default|Description|
|----|-------|-----------|
|endpoint|`/lb`|Your service endpoint|
|secret|`TYPE-YOUR-SECRET-HERE`|Secure your endpoint with secret|
|upstream_file|`array "name":"file"`|Your upstream file.|
|reload_nginx_config|`true`|Reload nginx config after generate.|
|reload_nginx_command|`nginx -s reload`|nginx reload command|
|sorted|`true`|Sort services by name|
|hostsfile|`/etc/hosts`|Hosts file|
|port|`9080`|Application port|
|upstream_default_prefix|`empty`|Upstream default prefix|
|upstream_default_suffix|`empty`|Upstream default suffix|
|upstream.always|`true`|It will add upstreams even there is no task.|
|upstream.default|`localhost`|Default upstream server if there is no task.|

And json file;

```json
{
    "endpoint": "/lb",
    "secret": "TYPE-YOUR-SECRET-HERE",
    "upstream_file": {
        "default": "./docker-upstream-default.conf",
        "global": "./docker-upstream-global.conf"
    },
    "reload_nginx_config": true,
    "reload_nginx_command": "nginx -s reload",
    "sorted": true,
    "hostsfile": "/etc/hosts",
    "port": 9080,
    "upstream_default_prefix": "",
    "upstream_default_suffix": "",
    "upstream": {
      "always": true,
      "default": "localhost"
    }
}
```