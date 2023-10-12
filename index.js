const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const vpcCIDRBlock = new pulumi.Config("my_vpc").require("cidrBlock");
const publicRouteTableCIDRBlock = new pulumi.Config("my_publicRouteTable").require("cidrBlock");
const region = new pulumi.Config("aws").require("region");

// Function to get available AWS availability zones
const getAvailableAvailabilityZones = async () => {
    const zones = await aws.getAvailabilityZones({ state: "available" });
    console.log(zones.names);
    return zones.names.slice(0, 3);
};

// Creating Virtual Private Cloud (VPC)
const my_vpc = new aws.ec2.Vpc("my_vpc", {
    cidrBlock: vpcCIDRBlock,
    instanceTenancy: "default",
    tags: {
        Name: "my_vpc",
    },
});

// Get available availability zones
const createSubnets = async () => {
    const availabilityZones = await getAvailableAvailabilityZones();
    // Internet Gateway and attaching it to the VPC
    const my_internetGateway = new aws.ec2.InternetGateway("my_internetGateway", {
        vpcId: my_vpc.id,
        tags: {
            Name: "my_internetGateway",
        },
    });

    // Public route table and associate all public subnets
    const my_publicRouteTable = new aws.ec2.RouteTable("my_publicRouteTable", {
        vpcId: my_vpc.id,
        routes: [
            {
                cidrBlock: publicRouteTableCIDRBlock, // The destination CIDR block for the internet
                gatewayId: my_internetGateway.id, // The internet gateway as the target
            },
        ],
        tags: {
            Name: "my_publicRouteTable",
        },
    });

    // Public route in the public route table with the internet gateway as the target
    const publicRoute = new aws.ec2.Route("publicRoute", {
        routeTableId: my_publicRouteTable.id,
        destinationCidrBlock: publicRouteTableCIDRBlock,
        gatewayId: my_internetGateway.id,
    });

    const my_publicSubnets = [];
    const my_privateSubnets = [];
    for (let i = 0; i < availabilityZones.length; i++) {
        // Create public subnet
        const publicSubnet = new aws.ec2.Subnet(`my_publicSubnet${i + 1}`, {
            vpcId: my_vpc.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: `10.0.1${i + 1}.0/24`, 
            tags: {
                Name: `my_publicSubnet${i + 1}`,
            },
        });
        my_publicSubnets.push(publicSubnet);

        // Create private subnet
        const privateSubnet = new aws.ec2.Subnet(`my_privateSubnet${i + 1}`, {
            vpcId: my_vpc.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: `10.0.2${i + 1}.0/24`, 
            tags: {
                Name: `my_privateSubnet${i + 1}`,
            },
        });
        my_privateSubnets.push(privateSubnet);
    }

    for (let i = 0; i < my_publicSubnets.length; i++) {
        new aws.ec2.RouteTableAssociation(`my_publicRouteTableAssociation-${i}`, {
            subnetId: my_publicSubnets[i].id,
            routeTableId: my_publicRouteTable.id,
        });
    }

    // Create a private route table and associate all private subnets
    const my_privateRouteTable = new aws.ec2.RouteTable("my_privateRouteTable", {
        vpcId: my_vpc.id,
        tags: {
            Name: "my_privateRouteTable",
        },
    });

    for (let i = 0; i < my_privateSubnets.length; i++) {
        new aws.ec2.RouteTableAssociation(`my_privateRouteTableAssociation-${i}`, {
            subnetId: my_privateSubnets[i].id,
            routeTableId: my_privateRouteTable.id,
        });
    }
};


//function to create subnets
createSubnets();