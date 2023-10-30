import { GraphQLClient } from "node_modules/@shopify/shopify-app-remix/build/ts/server/clients/types";
import db from "../db.server";
import qrcode from "qrcode";

type Error = {
    title: string;
    productId: string;
    destination: string;
}


export async function getQRCode(id: number, graphql: GraphQLClient) {
    const qrCode = await db.qRCode.findFirst({ where: { id } })

    if (!qrCode) {
        return null;
    }

    return supplementQRCode(qrCode, graphql);
}

export async function getQRCodes(shop: any, graphql: string) {
    const qrCodes = await db.qRCode.findMany({
        where: { shop },
        orderBy: { id: 'desc' },
    });

    if (qrCodes.length === 0) return [];

    return Promise.all(
        qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
    );
}

export function getQRCodeImage(id: number) {
    const url = new URL(`/qrCodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
    return qrcode.toDataURL(url.href);
}

export function getDestinationUrl(qrCode: any) {
    if (qrCode.destination === "product") {
        return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
    }
}

async function supplementQRCode(qrCode: any, graphql: any) {
    const qrCodeImagePromise = getQRCodeImage(qrCode.id);

    const response = graphql(
        `query supplementQRCode($id: ID!) {
            product(id: $id) {
                title,
                images(first: 1) {
                    nodes {
                        altText
                        url
                    }
                }
            }
        }`,
        {
            variables: {
                id: qrCode.productId
            },
        }
    );

    const {
        data: { product }
    } = await response.json();

    return {
        ...qrCode,
        productDeleted: !product?.title,
        productTitle: product?.title,
        productImage: product?.images?.nodes[0]?.url,
        productAlt: product?.images?.nodes[0]?.altText,
        destinationUrl: getDestinationUrl(qrCode),
        image: await qrCodeImagePromise
    };
}

export function validateQRCode(data: any) {
    const errors: Error = {
        title: "",
        productId: "",
        destination: ""
    };

    if (!data.title) {
        errors.title = "Title is required";
    }

    if (!data.productId) {
        errors.productId = "Product is required";
    }

    if (!data.destination) {
        errors.destination = "Destination us require"
    }

    if (Object.keys(errors).length) {
        return errors;
    }
}