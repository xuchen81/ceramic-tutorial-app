import "./App.css";
import "./index.css";
import { useState } from "react";
import { ethers } from "ethers";
import { EthereumAuthProvider, SelfID, WebClient } from "@self.id/web";
import { CeramicClient } from "@ceramicnetwork/http-client";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateTwoToneIcon from "@mui/icons-material/CreateTwoTone";
import TextField from "@mui/material/TextField";
import CastConnectedIcon from "@mui/icons-material/CastConnected";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import CancelIcon from "@mui/icons-material/Cancel";
import ColoredLine from "./components/ColoredLine.js";
import BYOF from "./BYOF.png";
import { Core } from "@self.id/core";
import { Caip10Link } from "@ceramicnetwork/stream-caip10-link";
import { TileDocument } from "@ceramicnetwork/stream-tile";

function App() {
  const endpoint = "https://gateway-clay.ceramic.network";
  // const endpoint = "https://ceramic-clay.3boxlabs.com";
  // const endpoint = "http://localhost:7007";
  const [accountConnected, setAccountConnected] = useState("");
  const [accountConnectedName, setAccountConnectedName] = useState("");
  const [addressToFollow, setAddressToFollow] = useState("");
  const [addressToRead, setAddressToRead] = useState("");
  const [self, setSelf] = useState("");
  const [data, setData] = useState("");
  const [connection, setConnected] = useState(false);
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const schema1 = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Reward",
    type: "object",
    properties: {
      title: { type: "string" },
      message: { type: "string" },
    },
    required: ["message", "title"],
  };

  // creates an internal Ceramic HTTP client connecting to localhost
  const API_URL = "http://localhost:7007";
  const ceramic = new CeramicClient(API_URL);

  // Importing an already created model and providing it to the Core instance
  const model = {
    definitions: {
      BYOFGRPH:
        "kjzl6cwe1jw146hx1pbfgxp7ynpbr3u9p60gkeqhf4k8bu7ui3bzsslfavfjwtg",
    },
    schemas: {
      BYOFGraph:
        "ceramic://k3y52l7qbv1fry8qoqefqj8khi30hm59k4oyeuicx7doxcfn47wqmh3cyqw74oy68",
    },
    tiles: {},
  };
  const core = new Core({ ceramic: "http://localhost:7007", model });

  // hook up ethers provider
  const url =
    "https://eth-mainnet.alchemyapi.io/v2/CLmJpTstUWu9_rXcDqhGabs67wZWhOSb";
  const provider = new ethers.providers.JsonRpcProvider(url);

  async function connect() {
    // Connect via metamask
    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    console.log("connected with Metamask!");

    //Authenticate via 3ID
    await createDid(address);

    console.log("succesfully authenticated via 3ID!");
    setAccountConnected(address);

    setAccountConnectedName(await reverseResolution(address));
    setConnected(true);
  }

  async function createDid(addr) {
    // providing the new model to the self instance
    const self = await SelfID.authenticate({
      authProvider: new EthereumAuthProvider(window.ethereum, addr),
      ceramic: "local",
      connectNetwork: "testnet-clay",
      model,
    });
    setSelf(self);
  }

  async function readFollowingList(address) {
    if (address.endsWith(".eth")) {
      const ensName = await directResolution(address);
      ensName
        ? settData(ensName)
        : setErrorMessage("This ENS name does not exist");
      return;
    }

    await settData(address);
  }

  async function settData(address) {
    const accountLink = await Caip10Link.fromAccount(
      ceramic,
      `${address}@eip155:1`
    );

    const linkedDid = accountLink.did;

    if (linkedDid) {
      const profile = await core.get("BYOFGRPH", linkedDid);
      if (!profile) {
        return;
      }
      const { followingList } = profile;
      const mappedAddresses = await Promise.all(
        //Return all the values
        followingList.map(async (item) => {
          //Call ENS reverse resolution for each item
          const name = await reverseResolution(item);
          // if no ENS name associated to an address name resolves again to the address. {address: 0xa, name: 0xa}
          return { address: item, name: name };
        })
      );
      setData({ ...profile, mappedAddresses: mappedAddresses });
    }

    if (!linkedDid) setErrorMessage("No DID associated with this account");
  }

  async function handleRemove(id) {
    const list = data.followingList;
    const newFollowings = list.filter((item) => list.indexOf(item) !== id);

    await self.set("BYOFGRPH", {
      address: accountConnected,
      followingList: newFollowings,
    });

    await settData(accountConnected);
  }

  async function reverseResolution(address) {
    var name = await provider.lookupAddress(address);
    if (name) return name;
    else return address;
  }

  async function directResolution(ensName) {
    const address = await provider.resolveName(ensName);
    if (address) return address;
  }

  async function updateFollowingList() {
    if (addressToFollow.endsWith(".eth")) {
      if (await directResolution(addressToFollow)) {
        const address = await directResolution(addressToFollow);
        let followings;
        if (data && data.followingList) {
          followings = data.followingList;
        } else {
          followings = [];
        }

        followings.push(address);

        await self.set("BYOFGRPH", {
          address: accountConnected,
          followingList: followings,
        });

        await settData(accountConnected);
        setWriting(true);
        setErrorMessage("");
        return;
      }

      if (!(await directResolution(addressToFollow))) {
        setErrorMessage("This ENS name does not exist");
        return;
      }
    }

    if (!(await ethers.utils.isAddress(addressToFollow))) {
      setErrorMessage("the address you typed is not valid!");
    }

    if (data && data.followingList.indexOf(addressToFollow) == 0) {
      setErrorMessage("You are already following this address");
      return;
    }

    if (await ethers.utils.isAddress(addressToFollow)) {
      let followings;

      if (data && data.followingList) {
        followings = data.followingList;
      } else {
        followings = [];
      }

      followings.push(addressToFollow);

      await self.set("BYOFGRPH", {
        address: accountConnected,
        followingList: followings,
      });

      await settData(accountConnected);
      setWriting(true);
      setErrorMessage("");
    }
  }

  async function getRecord() {
    console.log("==== clicked");
    const endpoint = "https://gateway-clay.ceramic.network";

    let ethereum = window.ethereum;
    let record;

    const addresses = await ethereum.request({ method: "eth_requestAccounts" });
    const address = addresses[0];
    // ----------------------------------------------------------------------------------------
    const authProvider = new EthereumAuthProvider(ethereum, address);
    console.log("....authProvider", authProvider);
    const client = new WebClient({
      ceramic: endpoint,
      connectNetwork: "testnet-clay",
    });
    const did = await client.authenticate(authProvider);

    console.log("========== client, did", client, did);
    const self = new SelfID({ client, did });

    const schema = "basicProfile";

    const data = await self.get(schema);

    console.log(data);
  }

  async function test() {
    const doc = await TileDocument.load(
      ceramic,
      "kjzl6cwe1jw14beeyjgaaewh4ubyrvyiwe3u4u43d4efpa0sg316zsdhah77gz1"
    );
    console.log("........ doc", doc);
  }

  async function write() {
    let ethereum = window.ethereum;
    let record;

    const addresses = await ethereum.request({ method: "eth_requestAccounts" });
    const address = addresses[0];
    // ----------------------------------------------------------------------------------------
    const authProvider = new EthereumAuthProvider(ethereum, address);

    const endpoint = "http://localhost:7007";
    const client = new WebClient({
      ceramic: endpoint,
      connectNetwork: "testnet-clay",
    });
    const did = await client.authenticate(authProvider);
    console.log("======== did", did);
    console.log("======== 1");
    const API_URL = "http://localhost:7007";
    const ceramic = new CeramicClient(API_URL);
    ceramic.setDID(did);
    const metadata = {
      controllers: [ceramic.did.id], // this will set yourself as the controller of the schema
    };
    console.log("======== 2");

    const deploy = await TileDocument.create(ceramic, schema1, metadata);
    console.log("deploy schema ", deploy);
    console.log("deploy schema id", deploy.id.toString());
    console.log("deploy schema commit id ", deploy.commitId.toString());

    const dataDoc = await TileDocument.create(
      ceramic,
      {
        title: "xuchen is testing  ????????????",
        message: "Hello World ???????????????????????????",
      },
      {
        controllers: [ceramic.did.id],
        schema: deploy.commitId.toString(),
      },
      {
        pin: true,
      }
    );
    console.log("dataDoc ====== 1 ", dataDoc);
    console.log("dataDoc ====== 2 ", dataDoc.id.toString());
    console.log("dataDoc ====== 2 ", dataDoc.id.toUrl());
  }

  return (
    <div className="App">
      {!connection && <img className="photo1" src={BYOF} />}
      {connection && <img className="photo2" src={BYOF} />}
      <ColoredLine color="blue" />

      {connection ? (
        <ButtonGroup>
          <Button
            startIcon={<MenuBookIcon />}
            color="secondary"
            variant="contained"
            onClick={() => {
              setReading(false);
              setWriting(true);
              readFollowingList(accountConnected);
              setErrorMessage("");
            }}
          >
            {" "}
            Read my following List
          </Button>
          <Button
            startIcon={<MenuBookIcon />}
            color="primary"
            variant="contained"
            onClick={() => {
              setReading(true);
              setWriting(false);
              setData("");
              setErrorMessage("");
            }}
          >
            {" "}
            Read someone else's following list{" "}
          </Button>
        </ButtonGroup>
      ) : (
        <Button
          startIcon={<CastConnectedIcon />}
          variant="contained"
          size="large"
          onClick={connect}
        >
          Connect
        </Button>
      )}

      {connection && (
        <header className="card">
          <h3> {accountConnectedName} connected to BYOF </h3>
        </header>
      )}

      {writing && data && data.followingList.length > 0 && (
        <div className="element">
          Here's the accounts you follow :
          <ul>
            {data.mappedAddresses.map((item) => (
              <ListItem key={data.mappedAddresses.indexOf(item)}>
                <Button
                  startIcon={<CancelIcon />}
                  color="secondary"
                  variant="contained"
                  onClick={() =>
                    handleRemove(data.followingList.indexOf(item.address))
                  }
                >
                  {" "}
                  Stop following{" "}
                </Button>
                <ListItemText primary={item.name} />
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    window.open(`https://opensea.io/${item.address}`);
                  }}
                >
                  {" "}
                  Check on OpenSea
                </Button>
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    window.open(`https://etherscan.io/address/${item.address}`);
                  }}
                >
                  {" "}
                  Check on Etherscan
                </Button>
              </ListItem>
            ))}
          </ul>
        </div>
      )}

      {writing && data && data.followingList.length == 0 && (
        <h3> No following accounts on your list, yet ... </h3>
      )}
      {writing && !data && (
        <h3> No following accounts on your list, yet ... </h3>
      )}

      {writing && (
        <div className="element">
          <TextField
            variant="filled"
            color="secondary"
            label="Address to follow"
            placeholder="0x00000..."
            onChange={(e) => setAddressToFollow(e.target.value)}
          />
          <Button
            startIcon={<CreateTwoToneIcon />}
            color="primary"
            variant="contained"
            onClick={() => {
              setErrorMessage("");
              updateFollowingList();
            }}
          >
            {" "}
            Update your following list{" "}
          </Button>
        </div>
      )}

      {reading && (
        <div className="element">
          <TextField
            variant="filled"
            color="secondary"
            label="Address to read"
            placeholder="0x00000..."
            onChange={(e) => setAddressToRead(e.target.value)}
          />
          <Button
            startIcon={<CreateTwoToneIcon />}
            color="primary"
            variant="contained"
            onClick={() => {
              setErrorMessage("");
              readFollowingList(addressToRead);
            }}
          >
            {" "}
            Read this account's list{" "}
          </Button>
        </div>
      )}

      {reading && data && data.followingList.length > 0 && (
        <div>
          <header className="card">
            {" "}
            <h3 className="container">
              {" "}
              Here's the accounts followed by {addressToRead} :{" "}
            </h3>{" "}
          </header>
          <ul>
            {data.mappedAddresses.map((item) => (
              <ListItem key={data.followingList.indexOf(item)} button>
                <ListItemText primary={item.name} />
              </ListItem>
            ))}
          </ul>
        </div>
      )}

      {reading && data && data.followingList.length == 0 && (
        <h3> No accounts followed by {addressToRead}, yet ... </h3>
      )}

      {errorMessage && <h3> {errorMessage} </h3>}

      <button onClick={getRecord}> get record </button>
      <button onClick={test}> test </button>
      <button onClick={write}> write </button>
    </div>
  );
}

export default App;
