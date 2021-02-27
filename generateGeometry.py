
buffer = ""
with open("truncated icosahedron.obj", "r") as f:
    buffer = f.read()


buffer = buffer.splitlines()

vs = []
vts = []
vns = []

vi = []
vti = []
vni = []

for line in buffer:
    if line[0] in ["#", "m", "o", "s", "u"]:
        continue

    if line.startswith("v "):
        v = line.split(" ")
        vs.append([float(v[1]), float(v[2]), float(v[3])])

    elif line.startswith("vt "):
        vt = line.split(" ")
        vts.append([float(vt[1]), float(vt[2])])

    elif line.startswith("vn "):
        vn = line.split(" ")
        vns.append([float(vn[1]), float(vn[2]), float(vn[3])])

    elif line.startswith("f "):
        hex = line.split(" ")
        ps = []
        for p in hex:
            if p == "f": continue
            ps.append(p.split("/"))

        if len(ps) == 6:
			## Hexagonal Faces
            vi.append([int(ps[0][0])-1, int(ps[1][0])-1, int(ps[2][0])-1])
            vi.append([int(ps[0][0])-1, int(ps[2][0])-1, int(ps[5][0])-1])
            vi.append([int(ps[5][0])-1, int(ps[2][0])-1, int(ps[3][0])-1])
            vi.append([int(ps[5][0])-1, int(ps[3][0])-1, int(ps[4][0])-1])

            vti.append([int(ps[0][1])-1, int(ps[1][1])-1, int(ps[2][1])-1])
            vti.append([int(ps[0][1])-1, int(ps[2][1])-1, int(ps[5][1])-1])
            vti.append([int(ps[5][1])-1, int(ps[2][1])-1, int(ps[3][1])-1])
            vti.append([int(ps[5][1])-1, int(ps[3][1])-1, int(ps[4][1])-1])

            vni.append([int(ps[0][2])-1, int(ps[1][2])-1, int(ps[2][2])-1])
            vni.append([int(ps[0][2])-1, int(ps[2][2])-1, int(ps[5][2])-1])
            vni.append([int(ps[5][2])-1, int(ps[2][2])-1, int(ps[3][2])-1])
            vni.append([int(ps[5][2])-1, int(ps[3][2])-1, int(ps[4][2])-1])
        elif len(ps) == 5:
			## Pentagonal Faces
            vi.append([int(ps[0][0])-1, int(ps[1][0])-1, int(ps[2][0])-1])
            vi.append([int(ps[0][0])-1, int(ps[2][0])-1, int(ps[4][0])-1])
            vi.append([int(ps[2][0])-1, int(ps[3][0])-1, int(ps[4][0])-1])

            vti.append([int(ps[0][1])-1, int(ps[1][1])-1, int(ps[2][1])-1])
            vti.append([int(ps[0][1])-1, int(ps[2][1])-1, int(ps[4][1])-1])
            vti.append([int(ps[2][1])-1, int(ps[3][1])-1, int(ps[4][1])-1])

            vni.append([int(ps[0][2])-1, int(ps[1][2])-1, int(ps[2][2])-1])
            vni.append([int(ps[0][2])-1, int(ps[2][2])-1, int(ps[4][2])-1])
            vni.append([int(ps[2][2])-1, int(ps[3][2])-1, int(ps[4][2])-1])


minU = 1000
maxU = -1000
minV = 1000
maxV = -1000

for vt in vts:
    minU = min(minU, vt[0])
    maxU = max(maxU, vt[0])
    minV = min(minV, vt[1])
    maxV = max(maxV, vt[1])

width = maxU - minU
height = maxV - minV

for i, vt in enumerate(vts):
    vts[i] = [
        round((vt[0] - minU) / width, 3),
        round((vt[1] - minV) / height, 3)]

for i, v in enumerate(vs):
    vs[i] = [
        round(v[0], 3),
        round(v[1], 3),
        round(v[2], 3)]

for i, v in enumerate(vns):
    vns[i] = [
        round(v[0], 3),
        round(v[1], 3),
        round(v[2], 3)]

print(vs, end=",\n")
print(vts, end=",\n")
print(vns, end=",\n")
print(vi, end=",\n")
print(vti, end=",\n")
print(vni, end=",\n")




