import assert from "node:assert/strict";
import test from "node:test";
import { isPublicPreviewRequest } from "../src/utils/preview.ts";

const request = (path, method = "GET") => new Request(`https://preview.example${path}`, { method });

test("public pages, media and search remain readable", () => {
	for (const path of ["/", "/posts", "/posts/%E6%97%A5%E6%9C%AC%E8%AA%9E", "/posts/100%25", "/_emdash/api/media/file/photo.jpg", "/_emdash/api/search"]) {
		for (const method of ["GET", "HEAD"]) assert.equal(isPublicPreviewRequest(request(path, method)), true, `${method} ${path}`);
	}
});

test("admin and private APIs stay blocked after router normalization", () => {
	for (const path of [
		"/_emdash", "/_emdash/admin/", "/_emdash/api/setup", "/_emdash/api/auth/session",
		"//_emdash/admin", "///_emdash/api/setup", "/%5Femdash/admin", "/%255Femdash/admin",
		"/%25255Femdash/api/setup", "/_emdash%2Fadmin", "/_emdash%252Fadmin",
		"/%5C_emdash/admin", "/_emdash%5Cadmin", "/public/%252e%252e/_emdash/admin",
		"/_emdash/api/media/file/%252e%252e/%252e%252e/auth/session",
	]) assert.equal(isPublicPreviewRequest(request(path)), false, path);
});

test("write methods are blocked on every preview path", () => {
	for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
		for (const path of ["/", "/_emdash/api/search", "/_emdash/api/media/file/photo.jpg"]) {
			assert.equal(isPublicPreviewRequest(request(path, method)), false, `${method} ${path}`);
		}
	}
});

test("malformed and excessively encoded paths fail closed", () => {
	assert.equal(isPublicPreviewRequest(request("/%ZZ")), false);
	let path = "/_emdash/admin";
	for (let i = 0; i < 15; i++) path = encodeURIComponent(path);
	assert.equal(isPublicPreviewRequest(request(`/${path}`)), false);
});
