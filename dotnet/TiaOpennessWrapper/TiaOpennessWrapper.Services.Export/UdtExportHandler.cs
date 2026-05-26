using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Types;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public class UdtExportHandler
{
	public object ExportUserDataType(PlcSoftware plcSoftware, string xmlFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_012e: Expected O, but got Unknown
		//IL_01f7: Expected O, but got Unknown
		//IL_0291: Expected O, but got Unknown
		//IL_024b: Unknown result type (might be due to invalid IL or missing references)
		//IL_0254: Unknown result type (might be due to invalid IL or missing references)
		string fileName = Path.GetFileName(xmlFilePath);
		try
		{
			FileInfo fileInfo = new FileInfo(xmlFilePath);
			PlcTypeGroup val = (PlcTypeGroup)(object)plcSoftware.TypeGroup;
			string text = "";
			if (options.PreserveFolderStructure && !string.IsNullOrEmpty(options.BasePath))
			{
				string relativeFolderPath = TiaGroupHelper.GetRelativeFolderPath(xmlFilePath, options.BasePath);
				if (!string.IsNullOrEmpty(relativeFolderPath))
				{
					val = TiaGroupHelper.GetOrCreateTypeGroup((PlcTypeGroup)(object)plcSoftware.TypeGroup, relativeFolderPath);
					text = " (group: " + relativeFolderPath + ")";
				}
			}
			string text2 = XmlComparisonService.ExtractNameFromXml(xmlFilePath) ?? Path.GetFileNameWithoutExtension(xmlFilePath);
			PlcType val2 = FindType(val, text2);
			if (val2 == null && (object)val != plcSoftware.TypeGroup)
			{
				val2 = FindType((PlcTypeGroup)(object)plcSoftware.TypeGroup, text2);
			}
			if (options.CompareBeforeImport && val2 != null)
			{
				switch (XmlComparisonService.CompareUdtWithXml(val2, xmlFilePath))
				{
				case BlockComparisonResult.Same:
					messages.Add(ExportMessage.Info(fileName, "UDT", "UDT '" + text2 + "' is identical - skipped"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				case BlockComparisonResult.Different:
					break;
				default:
					messages.Add(ExportMessage.Warning(fileName, "UDT", "UDT '" + text2 + "' exists but comparison failed - skipping"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				}
				try
				{
					val2.Delete();
					messages.Add(ExportMessage.Info(fileName, "UDT", "UDT '" + text2 + "' differs - deleted and will be reimported"));
					val2 = null;
				}
				catch (EngineeringException ex)
				{
					EngineeringException ex2 = ex;
					messages.Add(ExportMessage.Warning(fileName, "UDT", "Could not delete existing UDT '" + text2 + "': " + ((Exception)(object)ex2).Message + ". Trying import with Override..."));
				}
			}
			else if (options.OverwriteExisting && !options.CompareBeforeImport && val2 != null)
			{
				try
				{
					val2.Delete();
					messages.Add(ExportMessage.Info(fileName, "UDT", "Deleted existing UDT '" + text2 + "' before export"));
					val2 = null;
				}
				catch (EngineeringException ex3)
				{
					EngineeringException ex4 = ex3;
					messages.Add(ExportMessage.Warning(fileName, "UDT", "Could not delete UDT '" + text2 + "': " + ((Exception)(object)ex4).Message + ". Trying import with Override..."));
				}
			}
			ImportOptions val3 = (ImportOptions)(options.OverwriteExisting ? 1 : 0);
			val.Types.Import(fileInfo, val3);
			messages.Add(ExportMessage.Success(fileName, "UDT", "Exported successfully to " + plcSoftware.Name + text));
			return new
			{
				success = true,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (EngineeringException ex5)
		{
			string text3 = ErrorHelper.ExtractFullErrorMessage((Exception)ex5);
			messages.Add(ExportMessage.Error(fileName, "UDT", "Failed to export UDT to TIA Portal", text3, xmlFilePath));
			return new
			{
				success = false,
				error = text3,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (Exception ex6)
		{
			string text4 = ErrorHelper.ExtractFullErrorMessage(ex6);
			messages.Add(ExportMessage.Error(fileName, "UDT", "Failed to export UDT to TIA Portal", text4, xmlFilePath));
			return new
			{
				success = false,
				error = text4,
				filePath = xmlFilePath,
				messages = messages
			};
		}
	}

	private PlcType? FindType(PlcTypeGroup group, string name)
	{
		PlcType val = ((IEnumerable<PlcType>)group.Types).FirstOrDefault((PlcType t) => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
		if (val != null)
		{
			return val;
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			val = FindType((PlcTypeGroup)(object)group2, name);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}
}
