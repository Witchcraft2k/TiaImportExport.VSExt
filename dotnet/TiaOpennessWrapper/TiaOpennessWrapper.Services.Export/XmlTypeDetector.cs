using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace TiaOpennessWrapper.Services.Export;

public static class XmlTypeDetector
{
	public static XmlExportType DetectXmlType(string filePath)
	{
		try
		{
			string text = Path.GetExtension(filePath).ToLowerInvariant();
			switch (text)
			{
			case ".s7dcl":
				return XmlExportType.SdBlock;
			case ".s7res":
				return XmlExportType.SdResource;
			case ".scl":
				return XmlExportType.SclBlock;
			case ".db":
				return XmlExportType.SclBlock;
			default:
			{
				if (text != ".xml")
				{
					return XmlExportType.Unknown;
				}
				XElement root = XDocument.Load(filePath).Root;
				if (root == null)
				{
					return XmlExportType.Unknown;
				}
				if (root.Name.LocalName == "KnowHowProtectedBlock")
				{
					return XmlExportType.KnowHowProtectedBlock;
				}
				XElement xElement = ((root.Name.LocalName == "Document") ? root : root.Element("Document"));
				if (xElement != null)
				{
					if (xElement.Descendants().Any((XElement e) => e.Name.LocalName == "SW.Blocks.InstanceDB"))
					{
						return XmlExportType.InstanceDB;
					}
					if (xElement.Descendants().Any((XElement e) => e.Name.LocalName == "SW.Blocks.OB" || e.Name.LocalName == "SW.Blocks.FC" || e.Name.LocalName == "SW.Blocks.FB" || e.Name.LocalName == "SW.Blocks.DB" || e.Name.LocalName == "SW.Blocks.GlobalDB" || e.Name.LocalName.StartsWith("SW.Blocks.")))
					{
						return XmlExportType.Block;
					}
					if (xElement.Descendants().Any((XElement e) => e.Name.LocalName == "SW.Tags.PlcTagTable" || e.Name.LocalName.StartsWith("SW.Tags.")))
					{
						return XmlExportType.TagTable;
					}
					if (xElement.Descendants().Any((XElement e) => e.Name.LocalName == "SW.Types.PlcStruct" || e.Name.LocalName.StartsWith("SW.Types.")))
					{
						return XmlExportType.UserDataType;
					}
					if (xElement.Descendants().Any((XElement e) => e.Name.LocalName == "SW.WatchAndForceTables.PlcWatchTable" || e.Name.LocalName.StartsWith("SW.WatchAndForceTables.")))
					{
						return XmlExportType.WatchTable;
					}
				}
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(filePath);
				if (fileNameWithoutExtension.Contains("_FC") || fileNameWithoutExtension.Contains("_FB") || fileNameWithoutExtension.Contains("_OB") || fileNameWithoutExtension.Contains("_DB"))
				{
					return XmlExportType.Block;
				}
				return XmlExportType.Unknown;
			}
			}
		}
		catch
		{
			return XmlExportType.Unknown;
		}
	}

	public static string[] SortFilesForExport(string[] files)
	{
		List<string> first = UdtDependencySorter.SortByDependencies(files.Where((string f) => DetectXmlType(f) == XmlExportType.UserDataType).ToList());
		List<string> second = BlockDependencySorter.SortByDependencies(files.Where(delegate(string f)
		{
			XmlExportType xmlExportType = DetectXmlType(f);
			return xmlExportType == XmlExportType.Block || xmlExportType == XmlExportType.SdBlock || xmlExportType == XmlExportType.SclBlock || xmlExportType == XmlExportType.InstanceDB;
		}).ToList());
		return Enumerable.Concat(second: files.Where(delegate(string f)
		{
			XmlExportType xmlExportType = DetectXmlType(f);
			return xmlExportType != XmlExportType.UserDataType && xmlExportType != XmlExportType.Block && xmlExportType != XmlExportType.SdBlock && xmlExportType != XmlExportType.SclBlock && xmlExportType != XmlExportType.InstanceDB && xmlExportType != XmlExportType.SdResource;
		}).ToList(), first: first.Concat<string>(second)).ToArray();
	}

	public static string[] GetSupportedExtensions()
	{
		return new string[4] { ".xml", ".s7dcl", ".scl", ".db" };
	}
}
