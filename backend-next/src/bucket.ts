type UploadOptions = {
    key: string;
    body: string | Buffer;
    contentType: string;
    bucketName: string;
}

export const upload = async (options: UploadOptions) => {
    const { key, body, contentType } = options;

    return options
}