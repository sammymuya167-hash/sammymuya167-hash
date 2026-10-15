import{createHash,timingSafeEqual}from"node:crypto";
export async function handleAndroidRelease(req:Request,bucket:R2Bucket,secret:string){
 const j=(error:string,s:number)=>Response.json({error},{status:s,headers:{"Cache-Control":"no-store"}});
 const version=new URL(req.url).pathname.split("/").pop()??"";if(!/^v\d+\.\d+\.\d+$/.test(version))return j("Release not found.",404);
 const key="android/"+version+".apk";
 if(req.method==="GET"){const file=await bucket.get(key);if(!file)return j("The Android release is being prepared. Please try again shortly.",404);return new Response(file.body,{headers:{"Content-Type":"application/vnd.android.package-archive","Content-Disposition":'attachment; filename="ShadowSocial-'+version+'.apk"',"Content-Length":String(file.size),"Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","X-APK-SHA256":file.customMetadata?.sha256??""}})}
 if(req.method!=="POST")return j("Method not allowed.",405);
 const supplied=new TextEncoder().encode(req.headers.get("x-release-key")??""),expected=new TextEncoder().encode(secret);if(!secret||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return j("Unauthorized.",401);
 const size=Number(req.headers.get("content-length")),sha=req.headers.get("x-apk-sha256")??"";if(!Number.isSafeInteger(size)||size<1000000||size>100*1024*1024||!req.body||!/^[a-f0-9]{64}$/.test(sha))return j("Invalid release.",400);if(await bucket.head(key))return j("This release already exists.",409);
 const hash=createHash("sha256"),stream=new FixedLengthStream(size);
 try{await Promise.all([req.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){hash.update(chunk);controller.enqueue(chunk)}})).pipeTo(stream.writable),bucket.put(key,stream.readable,{httpMetadata:{contentType:"application/vnd.android.package-archive"},customMetadata:{sha256:sha,version,bytes:String(size)}})]);if(hash.digest("hex")!==sha){await bucket.delete(key);return j("Checksum mismatch.",400)}return Response.json({ok:true,version,bytes:size,sha256:sha},{status:201});}catch(e){await bucket.delete(key);console.error(JSON.stringify({event:"release.upload-failed",message:e instanceof Error?e.message:"Unknown"}));return j("Upload failed.",500)}
}
