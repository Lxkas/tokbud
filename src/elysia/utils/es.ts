import { Client, HttpConnection } from "@elastic/elasticsearch";

export const esClient = new Client({
	node: "http://localhost:9200",
	Connection: HttpConnection,
});
