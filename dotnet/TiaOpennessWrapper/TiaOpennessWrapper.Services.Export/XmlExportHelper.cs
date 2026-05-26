using System;
using System.Collections.Generic;
using System.Xml;

namespace TiaOpennessWrapper.Services.Export;

internal static class XmlExportHelper
{
	public static bool IsHwConfigXml(string xmlFilePath, out string? errorMessage)
	{
		errorMessage = null;
		try
		{
			XmlDocument xmlDocument = new XmlDocument();
			xmlDocument.Load(xmlFilePath);
			XmlElement documentElement = xmlDocument.DocumentElement;
			if (documentElement == null)
			{
				errorMessage = "XML document has no root element";
				return false;
			}
			if (documentElement.Name == "DeviceConfiguration" || documentElement.LocalName == "DeviceConfiguration" || documentElement.Name == "HardwareConfiguration" || documentElement.LocalName == "HardwareConfiguration")
			{
				return true;
			}
			string namespaceURI = documentElement.NamespaceURI;
			if (namespaceURI == null || !namespaceURI.Contains("Openness"))
			{
				string namespaceURI2 = documentElement.NamespaceURI;
				if (namespaceURI2 == null || !namespaceURI2.Contains("siemens"))
				{
					if (documentElement.Name == "CAEXFile" || documentElement.Name.Contains("AML"))
					{
						return true;
					}
					foreach (XmlNode childNode in documentElement.ChildNodes)
					{
						if (childNode.Name == "Device" || childNode.LocalName == "Device" || childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
						{
							return true;
						}
					}
					XmlNodeList xmlNodeList = documentElement.SelectNodes("//Device | //DeviceItem | //HwDevice");
					if (xmlNodeList != null && xmlNodeList.Count > 0)
					{
						return true;
					}
					errorMessage = "Root element is '" + documentElement.Name + "' with namespace '" + documentElement.NamespaceURI + "', expected DeviceConfiguration or similar";
					return false;
				}
			}
			return true;
		}
		catch (Exception ex)
		{
			errorMessage = "XML parsing error: " + ex.Message;
			return false;
		}
	}

	public static List<XmlNode> FindNetworkInterfaceNodes(XmlNode parentNode)
	{
		List<XmlNode> list = new List<XmlNode>();
		FindNodesRecursive(parentNode, "NetworkInterface", list);
		return list;
	}

	public static List<XmlNode> FindChildNodes(XmlNode parentNode, string nodeName)
	{
		List<XmlNode> list = new List<XmlNode>();
		foreach (XmlNode childNode in parentNode.ChildNodes)
		{
			if (childNode.Name == nodeName || childNode.LocalName == nodeName)
			{
				list.Add(childNode);
			}
		}
		return list;
	}

	public static void FindNodesRecursive(XmlNode node, string nodeName, List<XmlNode> results)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (childNode.Name == nodeName || childNode.LocalName == nodeName)
			{
				results.Add(childNode);
			}
			if (childNode.HasChildNodes)
			{
				FindNodesRecursive(childNode, nodeName, results);
			}
		}
	}

	public static XmlNode? ParseDeviceNode(XmlDocument doc, XmlElement root)
	{
		XmlNode xmlNode = null;
		string namespaceURI = root.NamespaceURI;
		if (!string.IsNullOrEmpty(namespaceURI))
		{
			XmlNamespaceManager xmlNamespaceManager = new XmlNamespaceManager(doc.NameTable);
			xmlNamespaceManager.AddNamespace("hw", namespaceURI);
			xmlNode = root.SelectSingleNode("//hw:Device", xmlNamespaceManager);
			if (xmlNode == null && root.Name == "DeviceConfiguration")
			{
				xmlNode = root.SelectSingleNode("hw:Device", xmlNamespaceManager);
			}
		}
		if (xmlNode == null)
		{
			xmlNode = root.SelectSingleNode("//Device");
		}
		if (xmlNode == null && root.Name == "Device")
		{
			xmlNode = root;
		}
		if (xmlNode == null && root.Name == "DeviceConfiguration")
		{
			foreach (XmlNode childNode in root.ChildNodes)
			{
				if (childNode.Name == "Device" || childNode.LocalName == "Device")
				{
					xmlNode = childNode;
					break;
				}
			}
		}
		return xmlNode;
	}

	public static XmlNode? FindDeviceItemsNode(XmlNode deviceNode)
	{
		XmlNode xmlNode = null;
		string namespaceURI = deviceNode.NamespaceURI;
		if (!string.IsNullOrEmpty(namespaceURI))
		{
			XmlNamespaceManager xmlNamespaceManager = new XmlNamespaceManager(deviceNode.OwnerDocument.NameTable);
			xmlNamespaceManager.AddNamespace("hw", namespaceURI);
			xmlNode = deviceNode.SelectSingleNode("hw:DeviceItems", xmlNamespaceManager);
		}
		if (xmlNode == null)
		{
			xmlNode = deviceNode.SelectSingleNode("DeviceItems");
		}
		if (xmlNode == null)
		{
			foreach (XmlNode childNode in deviceNode.ChildNodes)
			{
				if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
				{
					xmlNode = childNode;
					break;
				}
			}
		}
		return xmlNode;
	}

	public static List<XmlNode> GetDeviceItemNodes(XmlNode xmlItemsNode)
	{
		List<XmlNode> list = new List<XmlNode>();
		string namespaceURI = xmlItemsNode.NamespaceURI;
		if (!string.IsNullOrEmpty(namespaceURI))
		{
			XmlNamespaceManager xmlNamespaceManager = new XmlNamespaceManager(xmlItemsNode.OwnerDocument.NameTable);
			xmlNamespaceManager.AddNamespace("hw", namespaceURI);
			XmlNodeList xmlNodeList = xmlItemsNode.SelectNodes("hw:DeviceItem", xmlNamespaceManager);
			if (xmlNodeList != null)
			{
				foreach (XmlNode item3 in xmlNodeList)
				{
					list.Add(item3);
				}
			}
		}
		if (list.Count == 0)
		{
			XmlNodeList xmlNodeList2 = xmlItemsNode.SelectNodes("DeviceItem");
			if (xmlNodeList2 != null)
			{
				foreach (XmlNode item4 in xmlNodeList2)
				{
					list.Add(item4);
				}
			}
		}
		if (list.Count == 0)
		{
			foreach (XmlNode childNode in xmlItemsNode.ChildNodes)
			{
				if (childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
				{
					list.Add(childNode);
				}
			}
		}
		return list;
	}
}
