# Usage: python3 quantize.py in.glb out.glb
# Quantizes a three.js-exported GLB (KHR_mesh_quantization): POSITION to
# normalized int16 with the node's scale/translation undoing it, NORMAL to
# normalized int8, TEXCOORD_0 to normalized uint16 when UVs are in [0, 1].
import json, struct, sys, array
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
jlen = struct.unpack_from('<I', b, 12)[0]
g = json.loads(b[20:20+jlen])
off = 20 + jlen
blen = struct.unpack_from('<I', b, off)[0]
binary = b[off+8: off+8+blen]
acc, bvs = g['accessors'], g['bufferViews']
def read(ai):
    a = acc[ai]; v = bvs[a['bufferView']]
    n = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    assert a['componentType'] == 5126 and v.get('byteStride', n * 4) == n * 4
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    f = array.array('f'); f.frombytes(binary[start:start + a['count']*n*4])
    return [f[i*n:(i+1)*n] for i in range(a['count'])], n
prim = g['meshes'][0]['primitives'][0]
pos, _ = read(prim['attributes']['POSITION'])
nor, _ = read(prim['attributes']['NORMAL'])
uv, _ = read(prim['attributes']['TEXCOORD_0'])
lo = [min(p[k] for p in pos) for k in range(3)]; hi = [max(p[k] for p in pos) for k in range(3)]
ext = max(h - l for h, l in zip(hi, lo)); scale = ext / 2; center = [(h + l) / 2 for h, l in zip(hi, lo)]
uvlo = min(min(t) for t in uv); uvhi = max(max(t) for t in uv)
print('uv range', uvlo, uvhi)
out = bytearray(); views = []
def add(data, target=34962):
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data), 'target': target}); out.extend(data)
    return len(views) - 1
clamp = lambda x, a, b: max(a, min(b, x))
q = lambda x: clamp(round(x * 32767), -32767, 32767)
P = bytearray()
for p in pos: P += struct.pack('<hhhh', *[q((p[k] - center[k]) / scale) for k in range(3)], 0)
N = bytearray()
for n in nor: N += struct.pack('<bbbb', *[clamp(round(n[k] * 127), -127, 127) for k in range(3)], 0)
newacc = []
def accessor(view, ctype, typ, count, normalized, mn=None, mx=None):
    a = {'bufferView': view, 'componentType': ctype, 'count': count, 'type': typ, 'normalized': normalized}
    if mn is not None: a['min'], a['max'] = mn, mx
    newacc.append(a); return len(newacc) - 1
qp = [[q((p[k] - center[k]) / scale) for k in range(3)] for p in pos]
vP = add(P); vP_stride = 8
views[vP]['byteStride'] = 8
aP = accessor(vP, 5122, 'VEC3', len(pos), True, [min(v[k] for v in qp)/32767 for k in range(3)], [max(v[k] for v in qp)/32767 for k in range(3)])
vN = add(N); views[vN]['byteStride'] = 4
aN = accessor(vN, 5120, 'VEC3', len(nor), True)
if uvlo >= 0 and uvhi <= 1:
    U = bytearray()
    for t in uv: U += struct.pack('<HH', round(t[0] * 65535), round(t[1] * 65535))
    vU = add(U); aU = accessor(vU, 5123, 'VEC2', len(uv), True)
else:
    U = bytearray()
    for t in uv: U += struct.pack('<ff', t[0], t[1])
    vU = add(U); aU = accessor(vU, 5126, 'VEC2', len(uv), False)
# Indices: as uint16 when possible.
ia = acc[prim['indices']]; iv = bvs[ia['bufferView']]
istart = iv.get('byteOffset', 0) + ia.get('byteOffset', 0)
csize = {5121:1,5123:2,5125:4}[ia['componentType']]
fmt = {1:'B',2:'H',4:'I'}[csize]
idx = array.array(fmt); idx.frombytes(binary[istart:istart+ia['count']*csize])
I = array.array('H', idx).tobytes() if max(idx) < 65536 else idx.tobytes()
vI = add(I, 34963); aI = accessor(vI, 5123 if max(idx) < 65536 else 5125, 'SCALAR', len(idx), False)
# Images: copy their bytes.
for im in g.get('images', []):
    v = bvs[im['bufferView']]; data = binary[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}); out.extend(data)
    im['bufferView'] = len(views) - 1
for a in newacc:
    if a.get('normalized') is False: a.pop('normalized')
prim['attributes'] = {'POSITION': aP, 'NORMAL': aN, 'TEXCOORD_0': aU}
prim['indices'] = aI
g['accessors'], g['bufferViews'] = newacc, views
g['buffers'] = [{'byteLength': len(out)}]
node = [n for n in g['nodes'] if 'mesh' in n][0]
node['scale'] = [scale] * 3; node['translation'] = center
for k in ('extensionsUsed', 'extensionsRequired'): g[k] = sorted(set(g.get(k, [])) | {'KHR_mesh_quantization'})
while len(out) % 4: out.append(0)
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(out), b'BIN\x00') + out
open(dst, 'wb').write(glb)
print('wrote', dst, len(glb), 'bytes; position scale', scale, 'center', center)
