const fs = require('fs');
const exec = require('child_process').execSync;
const express = require("express");
const bodyParser = require("body-parser");
const configPath = "config.json";
const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

let configFile = fs.readFileSync(configPath);
const config = JSON.parse(configFile.toString());
const port = process.env.PORT || config.port || 9080;

const Keys = {
    UPSTREAM_PREFIX: "dupstream.upstream.prefix",
    UPSTREAM_SUFFIX: "dupstream.upstream.suffix",
    IGNORE: "dupstream.ignore",
    FILE: "dupstream.file",
}

function updateConfig(data) {

    if (!config.upstream_file)
        throw "There is no upstream_file definition in config.";

    if (!Object.keys(config.upstream_file).length)
        throw "There is no upstream_file definition in config.";

    const hostFilePath = process.env.HOSTSFILE || config.hostsfile || "/etc/hosts";

    let hostFileContent = fs.readFileSync(hostFilePath).toString();

    const hostHeader = "# <HOST-CONFIG>";
    const hostFooter = "# </HOST-CONFIG>";

    let hostFileLines = hostFileContent.split("\n");
    let startIndex = -1;
    let endIndex = -1;
    hostFileLines.forEach((element, index) => {
        if (element === hostHeader) {
            startIndex = index;
        }
        if (element === hostFooter) {
            endIndex = index;
        }
    });

    if (startIndex > -1 && endIndex > -1) {
        hostFileLines.splice(startIndex, (endIndex - startIndex) + 1);
    }

    hostFileLines.push(hostHeader);
    let nodes = {};
    data.nodes.forEach(node => {
        hostFileLines.push(`${node.Ip}\t${node.Name}`);
        nodes[node.Id] = node;
    });
    hostFileLines.push(hostFooter);
    let newHostFile = hostFileLines.join('\n');
    fs.writeFileSync(hostFilePath, newHostFile);

    if (config.sorted) {
        data.services.sort((a, b) => {
            if (a.Name < b.Name)
                return -1;
            if (a.Name > b.Name)
                return 1;
            return 0;
        });
    }

    let upstreamFiles = {};
    Object.keys(config.upstream_file).map(key => {
        upstreamFiles[key] = {
            name: key,
            content: "",
            path: config.upstream_file[key]
        };
    });

    data.services.map(service => {
        if (!service.Nodes.length && !config.upstream.always) return;
        if (!service.Ports.length) return;

        if (service.Labels[Keys.IGNORE]) return;

        const configName = service.Labels[Keys.FILE] || "default";
        if (!upstreamFiles[configName]) return;

        const port = service.Ports[0];
        let upstreamContent = `upstream ${service.Name} {\n`;
        if (service.Labels[Keys.UPSTREAM_PREFIX] && service.Labels[Keys.UPSTREAM_PREFIX].length) {
            upstreamContent += `\t${service.Labels[Keys.UPSTREAM_PREFIX]}\n\n`;
        } else if (config.upstream_default_prefix && config.upstream_default_prefix.length) {
            upstreamContent += `\t${config.upstream_default_prefix}\n\n`;
        }
        if (!service.Nodes.length) {
            upstreamContent += `\tserver\t${config.upstream.default}:${port.PublishedPort};\n`;
        } else {
            service.Nodes.map(nodeId => {
                const node = nodes[nodeId];
                if (!node) return;
                upstreamContent += `\tserver\t${node.Name}:${port.PublishedPort};\n`;
            });
        }

        if (service.Labels[Keys.UPSTREAM_SUFFIX] && service.Labels[Keys.UPSTREAM_SUFFIX].length) {
            upstreamContent += `\n\t${service.Labels[Keys.UPSTREAM_SUFFIX]}\n`;
        } else if (config.upstream_default_suffix && config.upstream_default_suffix.length) {
            upstreamContent += `\n\t${config.upstream_default_suffix}\n`;
        }
        upstreamContent += "}\n\n"

        upstreamFiles[configName].content += upstreamContent;
    });

    Object.keys(upstreamFiles).map(key => {
        const ufile = upstreamFiles[key];
        fs.writeFileSync(ufile.path, ufile.content);
        console.log(`${new Date()} Successfully written config file to ${ufile.path}.`);
    });

    if (config.reload_nginx_config) {
        try {
            exec(config.reload_nginx_command);
            return "Successfully updated your nginx configuration and reload the nginx.";
        } catch (error) {
            console.error(error);
            throw `We have updated config but, tried to run ${config.reload_nginx_command} and got error: ${error.message}`;
        }
    }
}

app.post(config.endpoint, async (req, res) => {
    var header = req.header("x-secret");

    if (header !== config.secret) {
        console.info("Invalid Secret");
        return res.send(401, {
            message: "Invalid Secret"
        });
    }
    const json = req.body;

    if (!json || !json.nodes || !json.services) {
        return res.send(400, {
            message: "Your model is invalid"
        });
    }

    if (!Array.isArray(json.nodes) || !Array.isArray(json.services)) {
        return res.send(400, {
            message: "nodes and services must be array."
        });
    }

    try {
        return res.send({
            message: updateConfig(json) || "Hi! I have updated things."
        });
    } catch (error) {
        console.error(error);
        return res.send(500, {
            message: `We are unable to proceed your request. ${error}`
        });
    }
});

app.listen(port, () => {
    console.log(`App is running on port ${port} and ${config.endpoint} endpoint!`);
});