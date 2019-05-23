import "jest"
import * as http from "http"
import axios from "axios"
import { ProviderBuilder } from "./test_data_factory"
import { Provider } from "papiea-core"

declare var process: {
    env: {
        SERVER_PORT: string
    }
};
const serverPort = parseInt(process.env.SERVER_PORT || '3000');

const entityApi = axios.create({
    baseURL: `http://127.0.0.1:${serverPort}/services`,
    timeout: 1000,
    headers: { 'Content-Type': 'application/json' }
});

const providerApi = axios.create({
    baseURL: `http://127.0.0.1:${serverPort}/provider`,
    timeout: 1000,
    headers: { 'Content-Type': 'application/json' }
});

describe("Procedures tests", () => {
    const hostname = '127.0.0.1';
    const port = 9001;
    const provider: Provider = new ProviderBuilder()
        .withVersion("0.1.0")
        .withKinds()
        .withCallback(`http://${hostname}:${port}`)
        .withEntityProcedures()
        .withKindProcedures()
        .withProviderProcedures()
        .build();
    const kind_name = provider.kinds[0].name;

    beforeAll(async () => {
        await providerApi.post('/', provider);
    });

    afterAll(async () => {
        await providerApi.delete(`/${provider.prefix}/${provider.version}`);
    });

    test("Call entity_procedure", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    const post = JSON.parse(body);
                    post.spec.x += post.input;
                    entityApi.put(`/${provider.prefix}/${provider.version}/${kind_name}/${post.metadata.uuid}`, {
                        spec: post.spec,
                        metadata: post.metadata
                    }).then(() => {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end(JSON.stringify(post.spec));
                        server.close();
                    }).catch((err) => {
                        console.log(err);
                    });
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        const { data: { metadata, spec } } = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}`, {
            spec: {
                x: 10,
                y: 11
            }
        });
        const res: any = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/${metadata.uuid}/procedure/moveX`, { input: 5 });
        const updatedEntity: any = await entityApi.get(`/${provider.prefix}/${provider.version}/${kind_name}/${metadata.uuid}`);
        expect(updatedEntity.data.metadata.spec_version).toEqual(2);
        expect(updatedEntity.data.spec.x).toEqual(15);
        done();
    });
    test("Procedure input validation", async (done) => {
        const { data: { metadata, spec } } = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}`, {
            spec: {
                x: 10,
                y: 11
            }
        });
        try {
            await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/${metadata.uuid}/procedure/moveX`, { input: "5" });
        } catch (err) {
            const res = err.response;
            expect(res.status).toEqual(400);
            expect(res.data.errors.length).toEqual(1);
            done();
            return;
        }
        done.fail();
    });
    test("Procedure empty input", async (done) => {
        const { data: { metadata, spec } } = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}`, {
            spec: {
                x: 10,
                y: 11
            }
        });
        try {
            await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/${metadata.uuid}/procedure/moveX`, {});
        } catch (err) {
            const res = err.response;
            expect(res.status).toEqual(400);
            expect(res.data.errors.length).toEqual(1);
            expect(res.data.errors[0].includes("undefined")).toBeTruthy();
            done();
            return;
        }
        done.fail();
    });
    test("Procedure result validation", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                req.on('data', function (data) {
                });
                req.on('end', function () {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(JSON.stringify({ "wrong": "result" }));
                    server.close();
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        const { data: { metadata, spec } } = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}`, {
            spec: {
                x: 10,
                y: 11
            }
        });
        try {
            await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/${metadata.uuid}/procedure/moveX`, { input: 5 });
        } catch (err) {
            const res = err.response;
            expect(res.status).toEqual(500);
            expect(res.data.errors.length).toEqual(2);
            expect(res.data.errors[0]).toEqual("x is a required field");
            expect(res.data.errors[1]).toEqual("y is a required field");
            done();
            return;
        }
        done.fail();
    });

    test("Call provider level procedure", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    const post = JSON.parse(body);
                    const sum = post.input.a + post.input.b;
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(JSON.stringify(sum));
                    server.close();
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        try {
            const res: any = await entityApi.post(`/${provider.prefix}/${provider.version}/procedure/computeSum`, {
                input: {
                    "a": 5,
                    "b": 5
                }
            });
            expect(res.data).toBe(10);
            done();
        } catch (e) {
            console.log(e.response.data);
            done.fail()
        }

    });

    test("Call provider level procedure with non-valid params fails validation", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    const post = JSON.parse(body);
                    const sum = post.input.a + post.input.b;
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(JSON.stringify(sum));
                    server.close();
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        try {
            const res: any = await entityApi.post(`/${provider.prefix}/${provider.version}/procedure/computeSum`, { input: { "a": 10, "b": "Totally not a number" } });
        } catch (e) {
            expect(e.response.status).toBe(400);
            server.close();
            done();
        }
    });

    test("Call kind level procedure", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    const post = JSON.parse(body);
                    let initial_cluster_location = "us.west.";
                    initial_cluster_location += post.input;
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(JSON.stringify(initial_cluster_location));
                    server.close();
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        const res: any = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/procedure/computeGeolocation`, { input: "2" });
        expect(res.data).toBe("us.west.2");
        done();
    });

    test("Call kind level procedure with non-valid params fails validation", async (done) => {
        const server = http.createServer((req, res) => {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    const post = JSON.parse(body);
                    let initial_cluster_location = "us.west.";
                    initial_cluster_location += post.input;
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(JSON.stringify(initial_cluster_location));
                    server.close();
                });
            }
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
        try {
            const res: any = await entityApi.post(`/${provider.prefix}/${provider.version}/${kind_name}/procedure/computeGeolocation`, { input: ["String expected got array"] });
        } catch (e) {
            expect(e.response.status).toBe(400);
            server.close();
            done();
        }
    });
});