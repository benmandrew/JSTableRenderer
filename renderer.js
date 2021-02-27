

function Table(width, height) {
    this.width = width;
    this.height = height;

    this.framebuffer = [];
    this.depthbuffer = [];
}

Table.prototype.initialise = function() {
    this.createTable();
    this.createBuffers();
}

Table.prototype.createTable = function() {
    let tableHTML = "";
    for (let y = 0; y < this.height; y++) {
        tableHTML += "<tr>";
        for (let x = 0; x < this.width; x++) {
            tableHTML += `<td id="(${x},${y})"></td>`;
        }
        tableHTML += "</tr>";
    }
    let table = document.getElementById("table");
    table.innerHTML = tableHTML;
}

Table.prototype.createBuffers = function() {
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            this.framebuffer.push([255, 255, 255]);
            this.depthbuffer.push(1.0);
        }
    }
}

Table.prototype.clearBuffers = function() {
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            this.framebuffer[y * this.width + x] = [255, 255, 255];
            this.depthbuffer[y * this.width + x] = 1.0;
        }
    }
}

Table.prototype.renderMesh = function(mesh, view, persp) {
    let n = mesh.nTriangles();
    mesh.transformVertices(mesh.modelMat, view, persp);
    for (let i = 0; i < n; i++) {
        let n = mesh.getViewFaceNormal(i);
        if (n[2] > 0.0) continue;
        this.renderTriangle(mesh, mesh.getFaceVert(i), i);
    }
}

Table.prototype.renderTriangle = function(mesh, f, i) {
    f = [this.NDCToScreenSpace(f[0]),
         this.NDCToScreenSpace(f[1]),
         this.NDCToScreenSpace(f[2])];
    let minX = Math.floor(Math.min(f[0][0], f[1][0], f[2][0]));
    let maxX = Math.ceil(Math.max(f[0][0], f[1][0], f[2][0]));
    let minY = Math.floor(Math.min(f[0][1], f[1][1], f[2][1]));
    let maxY = Math.ceil(Math.max(f[0][1], f[1][1], f[2][1]));

    if (minX >= this.width || maxX < 0 ||
        minY >= this.height || maxY < 0) {
        return;
    }

    minX = Math.max(0, Math.min(this.width - 1, minX));
    maxX = Math.max(0, Math.min(this.width - 1, maxX));
    minY = Math.max(0, Math.min(this.height - 1, minY));
    maxY = Math.max(0, Math.min(this.height - 1, maxY));

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            let point = [x, y];
            if (pointInsideTriangle(point, f[0], f[1], f[2])) {
                let depth = mesh.sampleDepth(point, f, i);
                if (depth <= 0.1) {
                    continue;
                }
                depth = depth / (1.0 + depth);
                if (depth < this.depthbuffer[y * this.width + x]) {
                    let rgb = mesh.sample(point, f, i);
                    if (rgb != undefined) {
                        light = lighting(mesh.getViewFaceNormal(i));
                        rgb = [light * rgb[0], light * rgb[1], light * rgb[2]]
                        this.framebuffer[y * this.width + x] = rgb;
                        this.depthbuffer[y * this.width + x] = depth;
                    }
                }
            }
        }
    }
}

Table.prototype.drawToTable = function() {
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            let cell = document.getElementById(`(${x},${y})`);
            let rgb = this.framebuffer[y * this.width + x];
            if (x == 0 || x == this.width - 1 || y == 0 || y == this.height - 1) {
                rgb = [0, 0, 0];
            }
            cell.style.backgroundColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        }
    }
}

Table.prototype.NDCToScreenSpace = function(v) {
    return [0.5 * (this.width * v[0] + this.width), 0.5 * (this.height * v[1] + this.height), v[2]];
}


function Texture(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data;
}

Texture.prototype.sample = function(x, y) {
    let xn = Math.round(clamp(x * this.width - 0.5, 0.0, this.height - 1));
    let yn = Math.round(clamp(y * this.height - 0.5, 0.0, this.height - 1));
    return this.data[yn * this.width + xn];
}


function Mesh(vs, vts, vns, fs, fts, fns, texture) {
    this.vs = vs;
    this.vts = vts;
    this.vns = vns;
    this.fs = fs;
    this.fts = fts;
    this.fns = fns;
    this.texture = texture;
    this.perspvs = [];
    this.viewvs = [];
    this.viewns = [];

    this.angle = 3.0;
    this.modelMat = [
        Math.cos(this.angle), 0, Math.sin(this.angle), 0,
        0, 1, 0, 0,
        -Math.sin(this.angle), 0, Math.cos(this.angle), 0,
        0, 0, 0, 1];
}

Mesh.prototype.nTriangles = function() {
    return this.fs.length;
}

Mesh.prototype.getFaceVert = function(i) {
    let fi = this.fs[i];
    return [this.perspvs[fi[0]], this.perspvs[fi[1]], this.perspvs[fi[2]]];
}

Mesh.prototype.getViewFaceVert = function(i) {
    let fi = this.fs[i];
    return [this.viewvs[fi[0]], this.viewvs[fi[1]], this.viewvs[fi[2]]];
}

Mesh.prototype.getFaceTex = function(i) {
    let fi = this.fts[i];
    return [this.vts[fi[0]], this.vts[fi[1]], this.vts[fi[2]]];
}

Mesh.prototype.getViewFaceNormal = function(i) {
    let fi = this.fns[i];
    return this.viewns[fi[0]];
}

Mesh.prototype.sampleDepth = function(point, f, i) {
    let viewf = this.getViewFaceVert(i);
    let bary = getBarycentricCoords(point, f[0], f[1], f[2]);
    return bary[0] * viewf[0][2] + bary[1] * viewf[1][2] + bary[2] * viewf[2][2];
}

// https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/perspective-correct-interpolation-vertex-attributes
Mesh.prototype.sample = function(point, f, i) {
    let t = this.getFaceTex(i);
    let viewf = this.getViewFaceVert(i);
    // Perspective-correct texture coordinates
    corrt = [
        [t[0][0] / viewf[0][2], t[0][1] / viewf[0][2]],
        [t[1][0] / viewf[1][2], t[1][1] / viewf[1][2]],
        [t[2][0] / viewf[2][2], t[2][1] / viewf[2][2]]];
    invz = [1.0 / viewf[0][2], 1.0 / viewf[1][2], 1.0 / viewf[2][2]];
    let bary = getBarycentricCoords(point, f[0], f[1], f[2]);
    let tex = [
        bary[0] * corrt[0][0] + bary[1] * corrt[1][0] + bary[2] * corrt[2][0],
        bary[0] * corrt[0][1] + bary[1] * corrt[1][1] + bary[2] * corrt[2][1]];
    let z = 1.0 / (
        bary[0] * invz[0] + bary[1] * invz[1] + bary[2] * invz[2]);
    return this.texture.sample(tex[0] * z, tex[1] * z);
}

Mesh.prototype.initVertices = function() {
    this.viewvs = [];
    this.viewns = [];
    this.perspvs = [];

    for (let i = 0; i < this.vs.length; i++) {
        this.viewvs.push([0, 0, 0]);
        this.perspvs.push([0, 0, 0]);
    }
    for (let i = 0; i < this.vs.length; i++) {
        this.viewns.push([0, 0, 0]);
    }
}

Mesh.prototype.transformVertices = function(model, view, persp) {
    view = matMul(view, model);
    persp = matMul(persp, view);

    // Explicitly copying data in makes the garbage collector work a lot more incrementally
    // Otherwise we get huge stutters every few seconds.
    for (let i = 0; i < this.vs.length; i++) {
        v = transformVertex(view, this.vs[i])
        this.viewvs[i][0] = v[0];
        this.viewvs[i][1] = v[1];
        this.viewvs[i][2] = v[2];
    }
    for (let i = 0; i < this.vns.length; i++) {
        v = transformVector(view, this.vns[i]);
        this.viewns[i][0] = v[0];
        this.viewns[i][1] = v[1];
        this.viewns[i][2] = v[2];
    }
    for (let i = 0; i < this.vs.length; i++) {
        v = transformVertex(persp, this.vs[i]);
        this.perspvs[i][0] = v[0];
        this.perspvs[i][1] = v[1];
        this.perspvs[i][2] = v[2];
    }
}

Mesh.prototype.spin = function() {
    this.angle += 1.0 * (Math.PI / 180.0);
    this.modelMat = [
        Math.cos(this.angle), 0, Math.sin(this.angle), 0,
        0, 1, 0, 0,
        -Math.sin(this.angle), 0, Math.cos(this.angle), 0,
        0, 0, 0, 1];
}


function Camera(position, direction, fov) {
    this.pos = position;
    this.dir = direction;
    this.invTanFov = 1 / Math.tan(fov * Math.PI / 360);
    this.zLims = [0.01, 50];
}

Camera.prototype.getViewMat = function() {
    // Right vector by cross product
    orient = matTranspose([
        -this.dir[2], 0, this.dir[0], 0,
        0,            1, this.dir[1], 0,
        this.dir[0],  0, this.dir[2], 0,
        0, 0, 0, 1
    ]);
    translate = [
        1, 0, 0, -this.pos[0],
        0, 1, 0, -this.pos[1],
        0, 0, 1, -this.pos[2],
        0, 0, 0, 1,
    ];
    // return matInverse(matMul(translate, orient));
    return matMul(orient, translate);
}

Camera.prototype.getProjectionMat = function() {
    return [
        this.invTanFov, 0, 0, 0,
        0, this.invTanFov, 0, 0,
        0, 0,
            - (this.zLims[1] + this.zLims[0]) / (this.zLims[1] - this.zLims[0]),
            - (2 * this.zLims[1] * this.zLims[0]) / (this.zLims[1] - this.zLims[0]),
        0, 0, -1, 0
    ];
}


function clamp(v, a, b) {
    return Math.max(a, Math.min(v, b));
}

function signFunction(a, b, p) {
    return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
}

function pointInsideTriangle(point, a, b, c) {
    let d0 = signFunction(a, b, point);
    let d1 = signFunction(b, c, point);
    let d2 = signFunction(c, a, point);
    let hasNeg = (d0 < 0) || (d1 < 0) || (d2 < 0);
    let hasPos = (d0 > 0) || (d1 > 0) || (d2 > 0);
    return !(hasNeg && hasPos);
}

function getBarycentricCoords(point, a, b, c) {
    let w1 = (
        ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) /
        ((b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])));
    let w2 = (
        ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) /
        ((b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])));
    return [w1, w2, 1 - w1 - w2];
}

function matMul(a, b) {
    let res = [];
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            let v = 0;
            for (let k = 0; k < 4; k++) {
                v += a[i * 4 + k] * b[k * 4 + j];
            }
            res.push(v);
        }
    }
    return res;
}

function matTranspose(m) {
    return [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
    ];
}

function transformVertex(t, v) {
    w = t[12] * v[0] + t[13] * v[1] + t[14] * v[2] + t[15];
    invw = 1.0 / w
    if (w == 0) {
        invw = 1
    }
    return [
        invw * (t[0] * v[0] + t[1] * v[1] + t[2] * v[2] + t[3]),
        invw * (t[4] * v[0] + t[5] * v[1] + t[6] * v[2] + t[7]),
        invw * (t[8] * v[0] + t[9] * v[1] + t[10] * v[2] + t[11])];
}

function transformVector(t, v) {
    return [
        t[0] * v[0] + t[1] * v[1] + t[2] * v[2],
        t[4] * v[0] + t[5] * v[1] + t[6] * v[2],
        t[8] * v[0] + t[9] * v[1] + t[10] * v[2]];
}

function triangleInsideNDCSpace(f) {
    return insideNDCSpace(f[0]) || insideNDCSpace(f[1]) || insideNDCSpace(f[2]);
}

function insideNDCSpace(v) {
    return (v[0] >= -1.0 && v[0] <= 1.0)
        && (v[1] >= -1.0 && v[1] <= 1.0)
        && (v[2] >= -1.0 && v[2] <= 1.0);
}

function lighting(n) {
    // To directional light
    let l = [-0.577, 0.577, 0.577];
    return Math.pow((l[0] * n[0] + l[1] * n[1] + l[2] * n[2]) * 0.5 + 0.5, 0.7);
}

// --------------------------------------------
//           Configuration and driver          
// --------------------------------------------

let width = 128;
let height = 96;

let stop = false;
let step = false;

// Hard-coded texture data, just an RGB grid
let texture = new Texture(8, 8, [
    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0],
    [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255],
    [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0],
    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0],
    [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255],
    [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0],
    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0],
    [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255],
]);

// Hard-coded mesh data outputted from the Python file
let mesh = new Mesh(
    [[-1.411, 3.2, 0.0], [-0.706, 3.2, 1.222], [0.706, 3.2, 1.222], [1.411, 3.2, 0.0], [0.706, 3.2, -1.222], [-0.706, 3.2, -1.222], [-2.553, 2.385, -0.156], [-2.989, 1.57, 0.911], [-2.284, 1.57, 2.133], [-1.142, 2.385, 2.289], [-1.411, 2.385, -2.133], [-2.553, 1.881, -1.474], [-0.706, 1.57, -3.044], [1.411, 2.385, -2.133], [0.706, 1.57, -3.044], [-1.142, 0.252, -3.296], [-2.284, -0.252, -2.637], [-2.989, 0.563, -1.726], [-0.0, -0.563, -3.452], [-0.0, -1.881, -2.948], [-1.142, -2.385, -2.289], [-2.284, -1.57, -2.133], [1.142, 0.252, -3.296], [2.284, -0.252, -2.637], [2.284, -1.57, -2.133], [1.142, -2.385, -2.289], [2.553, 1.881, -1.474], [2.989, 0.563, -1.726], [2.553, 2.385, -0.156], [2.989, 1.57, 0.911], [3.425, 0.252, 0.659], [3.425, -0.252, -0.659], [1.142, 2.385, 2.289], [2.284, 1.57, 2.133], [-0.0, 1.881, 2.948], [-2.284, 0.252, 2.637], [-1.142, -0.252, 3.296], [-0.0, 0.563, 3.452], [-3.425, 0.252, 0.659], [-2.989, -0.563, 1.726], [-3.425, -0.252, -0.659], [-2.989, -1.57, -0.911], [-2.553, -2.385, 0.156], [-2.553, -1.881, 1.474], [-0.706, -3.2, -1.222], [-1.411, -3.2, 0.0], [0.706, -3.2, -1.222], [2.989, -1.57, -0.911], [2.553, -2.385, 0.156], [1.411, -3.2, 0.0], [2.989, -0.563, 1.726], [2.553, -1.881, 1.474], [2.284, 0.252, 2.637], [1.142, -0.252, 3.296], [0.706, -1.57, 3.044], [1.411, -2.385, 2.133], [-0.706, -1.57, 3.044], [-1.411, -2.385, 2.133], [-0.706, -3.2, 1.222], [0.706, -3.2, 1.222]],
    [[0.004, 0.508], [0.252, 0.072], [0.748, 0.072], [0.996, 0.508], [0.748, 0.944], [0.252, 0.944], [0.752, 0.938], [0.256, 0.938], [0.008, 0.502], [0.256, 0.066], [0.752, 0.066], [1.0, 0.502], [0.256, 0.853], [0.103, 0.374], [0.504, 0.078], [0.905, 0.374], [0.752, 0.853], [0.748, 0.072], [0.996, 0.507], [0.748, 0.943], [0.252, 0.943], [0.004, 0.507], [0.252, 0.072], [0.111, 0.193], [0.57, 0.003], [0.962, 0.311], [0.895, 0.81], [0.436, 1.0], [0.044, 0.692], [0.043, 0.689], [0.11, 0.19], [0.569, 0.0], [0.961, 0.308], [0.894, 0.807], [0.435, 0.997], [0.89, 0.19], [0.957, 0.689], [0.565, 0.997], [0.106, 0.807], [0.039, 0.308], [0.431, 0.0], [0.748, 0.847], [0.252, 0.847], [0.099, 0.368], [0.5, 0.072], [0.901, 0.368], [0.105, 0.81], [0.038, 0.311], [0.43, 0.003], [0.889, 0.193], [0.956, 0.692], [0.564, 1.0], [0.955, 0.31], [0.888, 0.809], [0.428, 0.999], [0.036, 0.691], [0.103, 0.192], [0.562, 0.002], [0.897, 0.374], [0.744, 0.853], [0.248, 0.853], [0.095, 0.374], [0.496, 0.078], [0.744, 0.066], [0.992, 0.502], [0.744, 0.938], [0.248, 0.938], [0.0, 0.502], [0.248, 0.066], [0.901, 0.369], [0.748, 0.847], [0.252, 0.847], [0.099, 0.369], [0.5, 0.073], [0.256, 0.845], [0.103, 0.367], [0.504, 0.071], [0.905, 0.367], [0.752, 0.845], [0.438, 0.002], [0.897, 0.192], [0.964, 0.691], [0.572, 0.999], [0.112, 0.809], [0.045, 0.31], [0.901, 0.633], [0.5, 0.929], [0.099, 0.633], [0.252, 0.155], [0.748, 0.155], [0.897, 0.367], [0.744, 0.845], [0.248, 0.845], [0.095, 0.367], [0.496, 0.071], [0.748, 0.154], [0.901, 0.633], [0.5, 0.929], [0.099, 0.633], [0.252, 0.154], [0.496, 0.935], [0.095, 0.639], [0.248, 0.16], [0.744, 0.16], [0.897, 0.639], [0.752, 0.16], [0.905, 0.639], [0.504, 0.935], [0.103, 0.639], [0.256, 0.16], [0.744, 0.153], [0.897, 0.631], [0.496, 0.927], [0.095, 0.631], [0.248, 0.153], [0.504, 0.927], [0.103, 0.631], [0.256, 0.153], [0.752, 0.153], [0.905, 0.631]],
    [[0.0, 1.0, 0.0], [-0.5773, 0.7454, 0.3333], [-0.5257, 0.7947, -0.3035], [0.0, 0.7454, -0.6667], [-0.5773, 0.3333, -0.7454], [-0.3568, -0.3333, -0.8727], [0.3568, -0.3333, -0.8727], [0.0, 0.1876, -0.9822], [0.5773, 0.3333, -0.7454], [0.9342, 0.3333, -0.1273], [0.5257, 0.7947, -0.3035], [0.5773, 0.7454, 0.3333], [0.0, 0.7947, 0.6071], [-0.3568, 0.3333, 0.8727], [-0.8506, 0.1876, 0.4911], [-0.9342, 0.3333, -0.1273], [-0.9342, -0.3333, 0.1273], [-0.5774, -0.7454, -0.3333], [0.0, -0.7947, -0.6071], [0.5774, -0.7454, -0.3333], [0.9342, -0.3333, 0.1273], [0.5773, -0.3333, 0.7454], [0.3568, 0.3333, 0.8727], [0.8506, 0.1876, 0.4911], [0.0, -0.1876, 0.9822], [-0.5773, -0.3333, 0.7454], [0.0, -0.7454, 0.6667], [0.0, -1.0, -0.0], [0.5257, -0.7947, 0.3035], [-0.5257, -0.7947, 0.3035], [0.8506, -0.1876, -0.4911], [-0.8506, -0.1876, -0.4911]],
    [[0, 1, 2], [0, 2, 5], [5, 2, 3], [5, 3, 4], [1, 0, 6], [1, 6, 9], [9, 6, 7], [9, 7, 8], [5, 10, 11], [5, 11, 0], [11, 6, 0], [12, 10, 5], [12, 5, 14], [14, 5, 4], [14, 4, 13], [15, 16, 17], [15, 17, 12], [12, 17, 11], [12, 11, 10], [18, 19, 20], [18, 20, 15], [15, 20, 21], [15, 21, 16], [19, 18, 22], [19, 22, 25], [25, 22, 23], [25, 23, 24], [12, 14, 22], [12, 22, 15], [22, 18, 15], [26, 27, 23], [26, 23, 13], [13, 23, 22], [13, 22, 14], [27, 26, 28], [27, 28, 31], [31, 28, 29], [31, 29, 30], [13, 4, 3], [13, 3, 26], [3, 28, 26], [29, 28, 3], [29, 3, 33], [33, 3, 2], [33, 2, 32], [32, 2, 1], [32, 1, 34], [1, 9, 34], [9, 8, 35], [9, 35, 34], [34, 35, 36], [34, 36, 37], [7, 38, 39], [7, 39, 8], [39, 35, 8], [40, 38, 7], [40, 7, 17], [17, 7, 6], [17, 6, 11], [41, 42, 43], [41, 43, 40], [40, 43, 39], [40, 39, 38], [21, 20, 44], [21, 44, 41], [41, 44, 45], [41, 45, 42], [20, 19, 25], [20, 25, 44], [25, 46, 44], [47, 48, 49], [47, 49, 24], [24, 49, 46], [24, 46, 25], [50, 51, 48], [50, 48, 30], [30, 48, 47], [30, 47, 31], [52, 53, 54], [52, 54, 50], [50, 54, 55], [50, 55, 51], [53, 52, 33], [53, 33, 37], [37, 33, 32], [37, 32, 34], [30, 29, 33], [30, 33, 50], [33, 52, 50], [54, 53, 37], [54, 37, 56], [37, 36, 56], [57, 56, 36], [57, 36, 43], [43, 36, 35], [43, 35, 39], [58, 59, 55], [58, 55, 57], [57, 55, 54], [57, 54, 56], [46, 49, 59], [46, 59, 44], [44, 59, 58], [44, 58, 45], [51, 55, 59], [51, 59, 48], [59, 49, 48], [58, 57, 43], [58, 43, 45], [43, 42, 45], [24, 23, 27], [24, 27, 47], [27, 31, 47], [17, 16, 21], [17, 21, 40], [21, 41, 40]],
    [[0, 1, 2], [0, 2, 5], [5, 2, 3], [5, 3, 4], [6, 7, 8], [6, 8, 11], [11, 8, 9], [11, 9, 10], [12, 13, 14], [12, 14, 16], [14, 15, 16], [17, 18, 19], [17, 19, 22], [22, 19, 20], [22, 20, 21], [23, 24, 25], [23, 25, 28], [28, 25, 26], [28, 26, 27], [29, 30, 31], [29, 31, 34], [34, 31, 32], [34, 32, 33], [35, 36, 37], [35, 37, 40], [40, 37, 38], [40, 38, 39], [41, 42, 43], [41, 43, 45], [43, 44, 45], [46, 47, 48], [46, 48, 51], [51, 48, 49], [51, 49, 50], [52, 53, 54], [52, 54, 57], [57, 54, 55], [57, 55, 56], [58, 59, 60], [58, 60, 62], [60, 61, 62], [63, 64, 65], [63, 65, 68], [68, 65, 66], [68, 66, 67], [69, 70, 71], [69, 71, 73], [71, 72, 73], [34, 29, 30], [34, 30, 33], [33, 30, 31], [33, 31, 32], [74, 75, 76], [74, 76, 78], [76, 77, 78], [79, 80, 81], [79, 81, 84], [84, 81, 82], [84, 82, 83], [84, 79, 80], [84, 80, 83], [83, 80, 81], [83, 81, 82], [7, 8, 9], [7, 9, 6], [6, 9, 10], [6, 10, 11], [85, 86, 87], [85, 87, 89], [87, 88, 89], [66, 67, 68], [66, 68, 65], [65, 68, 63], [65, 63, 64], [55, 56, 57], [55, 57, 54], [54, 57, 52], [54, 52, 53], [51, 46, 47], [51, 47, 50], [50, 47, 48], [50, 48, 49], [40, 35, 36], [40, 36, 39], [39, 36, 37], [39, 37, 38], [90, 91, 92], [90, 92, 94], [92, 93, 94], [95, 96, 97], [95, 97, 99], [97, 98, 99], [24, 25, 26], [24, 26, 23], [23, 26, 27], [23, 27, 28], [22, 17, 18], [22, 18, 21], [21, 18, 19], [21, 19, 20], [5, 0, 1], [5, 1, 4], [4, 1, 2], [4, 2, 3], [100, 101, 102], [100, 102, 104], [102, 103, 104], [105, 106, 107], [105, 107, 109], [107, 108, 109], [110, 111, 112], [110, 112, 114], [112, 113, 114], [115, 116, 117], [115, 117, 119], [117, 118, 119]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 2, 2], [2, 2, 2], [2, 2, 2], [3, 3, 3], [3, 3, 3], [3, 3, 3], [3, 3, 3], [4, 4, 4], [4, 4, 4], [4, 4, 4], [4, 4, 4], [5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 5, 5], [6, 6, 6], [6, 6, 6], [6, 6, 6], [6, 6, 6], [7, 7, 7], [7, 7, 7], [7, 7, 7], [8, 8, 8], [8, 8, 8], [8, 8, 8], [8, 8, 8], [9, 9, 9], [9, 9, 9], [9, 9, 9], [9, 9, 9], [10, 10, 10], [10, 10, 10], [10, 10, 10], [11, 11, 11], [11, 11, 11], [11, 11, 11], [11, 11, 11], [12, 12, 12], [12, 12, 12], [12, 12, 12], [13, 13, 13], [13, 13, 13], [13, 13, 13], [13, 13, 13], [14, 14, 14], [14, 14, 14], [14, 14, 14], [15, 15, 15], [15, 15, 15], [15, 15, 15], [15, 15, 15], [16, 16, 16], [16, 16, 16], [16, 16, 16], [16, 16, 16], [17, 17, 17], [17, 17, 17], [17, 17, 17], [17, 17, 17], [18, 18, 18], [18, 18, 18], [18, 18, 18], [19, 19, 19], [19, 19, 19], [19, 19, 19], [19, 19, 19], [20, 20, 20], [20, 20, 20], [20, 20, 20], [20, 20, 20], [21, 21, 21], [21, 21, 21], [21, 21, 21], [21, 21, 21], [22, 22, 22], [22, 22, 22], [22, 22, 22], [22, 22, 22], [23, 23, 23], [23, 23, 23], [23, 23, 23], [24, 24, 24], [24, 24, 24], [24, 24, 24], [25, 25, 25], [25, 25, 25], [25, 25, 25], [25, 25, 25], [26, 26, 26], [26, 26, 26], [26, 26, 26], [26, 26, 26], [27, 27, 27], [27, 27, 27], [27, 27, 27], [27, 27, 27], [28, 28, 28], [28, 28, 28], [28, 28, 28], [29, 29, 29], [29, 29, 29], [29, 29, 29], [30, 30, 30], [30, 30, 30], [30, 30, 30], [31, 31, 31], [31, 31, 31], [31, 31, 31]],
    texture);

let camera = new Camera([0, 0, -10], [0, 0, 1], 55.0);
let table = new Table(width, height);


window.onload = function() {
    table.initialise();
    mesh.initVertices();
    render(false);
    requestAnimationFrame(mainLoop)
}

function render(clear) {
    if (clear) table.clearBuffers();
    table.renderMesh(
        mesh, camera.getViewMat(), camera.getProjectionMat());
    table.drawToTable();
}

function mainLoop() {
    if (!stop || step) {
        step = false;
        mesh.spin();
        render(true);
        requestAnimationFrame(mainLoop);
    }
}

function toggleRendering() {
    stop = !stop;
    if (!stop) requestAnimationFrame(mainLoop);
}

function stepRendering() {
    if (!stop) return;
    step = true;
    requestAnimationFrame(mainLoop)
}



