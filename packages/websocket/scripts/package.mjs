import "zx/globals";
cd(path.resolve(__dirname, "..", "..", ".."));

const imageName = "websocket";
const tagName = await $`git rev-parse --short HEAD`;

await $`docker build -t ${imageName}:${tagName} .`;
const containerId = await $`docker create ${imageName}:${tagName}`;
await $`docker cp ${containerId}:/work/package.zip .`;
await $`docker rm ${containerId}`;
