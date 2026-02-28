import asyncio
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession


async def main():
    server = StdioServerParameters(command="py", args=["mcp_server.py"])

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("TOOLS:", [t.name for t in tools.tools])

            res = await session.call_tool(
                "get_facility_profile",
                {"facility_id": "demo_facility"}
            )
            print("FACILITY RESULT:", res.content)

            create_res = await session.call_tool(
                "create_proposal",
                {"facility_id": "demo_facility"}
            )
            print("CREATE PROPOSAL RESULT:", create_res.content)


if __name__ == "__main__":
    asyncio.run(main())